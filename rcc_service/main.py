#!/usr/bin/env python3
"""
YourLittleCase! — RCCService  (Full 3D Rendering Edition)
==========================================================

Renders actual 3D thumbnails from the character_model.obj using pyrender.
Supports all thumbnail types that Roblox's RCCService and Avatar Rendering API
provides: full-body, headshot, bust, item previews — at any standard size.

Thumbnail types (matching Roblox API)
--------------------------------------
  full_body   Full character from feet to top of hat
  headshot    Head and shoulders only (close crop)
  bust        Waist and up
  item        Single item preview (no character)

Sizes (matching Roblox)
------------------------
  48, 60, 75, 100, 110, 150, 180, 352, 420, 720  (pixels, square)

Camera options (matching Roblox thumbnail customization API)
-------------------------------------------------------------
  fov_deg       Field of view in degrees (15–60, default per type)
  y_rot_deg     Y rotation of character (-60 to 60, default 0)
  distance_scale  Multiplier on base camera distance (0.5–4, default 1.0)
  bg_color      Background hex color or 'transparent'

Concurrency
-----------
  Run via gunicorn with sync workers (one per CPU core × 2 + 1).
  Each worker owns its own pyrender context; a per-process threading.Lock
  serialises the actual OpenGL call within each worker.
  Two-layer cache: in-memory LRU + disk.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import logging
import os
import threading
import time
from collections import OrderedDict
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image, ImageDraw, ImageFilter

# ── numpy 2.x compatibility shim ─────────────────────────────────────────────
for _a, _v in [('infty', float('inf')), ('bool', bool), ('int', int), ('float', float), ('complex', complex)]:
    if not hasattr(np, _a):
        setattr(np, _a, _v)

# ── Optional 3-D imports ──────────────────────────────────────────────────────
PYRENDER_OK = False
try:
    import trimesh
    import pyrender
    from pyrender import (
        Scene, Mesh, Node, PerspectiveCamera, OffscreenRenderer,
        DirectionalLight, SpotLight, AmbientLight, RenderFlags,
        MetallicRoughnessMaterial,
    )
    PYRENDER_OK = True
except Exception as _e:
    logging.warning("pyrender/trimesh unavailable (%s) — PIL fallback active", _e)

# ── Optional DB ───────────────────────────────────────────────────────────────
DB_OK = False
try:
    from sqlalchemy import create_engine, text as sa_text
    DB_OK = True
except ImportError:
    pass

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [RCC/%(process)d] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("rcc")

app = Flask(__name__)

CFG: Dict[str, Any] = {
    "obj_path":   str(Path(__file__).parent.parent / "public" / "models" / "character_model.obj"),
    "output_dir": str(Path(__file__).parent.parent / "storage" / "app" / "public"),
    "db_url":     None,
    "cache_size": 512,
}

_render_lock = threading.Lock()

# ── Character geometry constants (measured from the OBJ) ─────────────────────
# All Y values are in OBJ units after normalisation to height=1.0
# Raw values: total height ≈ 5.101, from Y=0.029 to Y=5.130
_RAW_HEIGHT    = 5.130 - 0.029   # ≈ 5.101
_SCALE         = 1.0 / _RAW_HEIGHT

# Normalised (0→1) Y boundaries for each body region
_HEAD_Y_BOT  = (3.930 - 0.029) * _SCALE   # ≈ 0.765
_HEAD_Y_TOP  = (5.130 - 0.029) * _SCALE   # ≈ 1.000  (top of head)
_TORSO_Y_BOT = (1.960 - 0.029) * _SCALE   # ≈ 0.378
_TORSO_Y_TOP = (4.030 - 0.029) * _SCALE   # ≈ 0.784
_LEG_Y_BOT   = (0.029 - 0.029) * _SCALE   # ≈ 0.000  (feet)
_LEG_Y_TOP   = (1.960 - 0.029) * _SCALE   # ≈ 0.378

# Head horizontal centre (normalised)
_HEAD_CX = (-0.57 - (-1.165)) / (_RAW_HEIGHT)   # ≈ 0.115
_HEAD_CZ = (-0.01 - (-2.012)) / (_RAW_HEIGHT)   # ≈ 0.393

# ── OBJ part → clothing slot ──────────────────────────────────────────────────
PART_SLOTS = {
    "head":      "face",
    "torso":     "shirt",
    "left_arm":  "shirt",
    "right_arm": "shirt",
    "left_leg":  "pants",
    "right_leg": "pants",
}

# ── Camera presets (matching Roblox thumbnail types) ─────────────────────────
# target_y_norm: normalised Y the camera looks at
# dist_norm:     camera distance in normalised units
# fov_deg:       vertical field of view
CAMERA_PRESETS = {
    "full_body": {"target_y_norm": 0.50, "dist_norm": 2.20, "fov_deg": 30.0},
    "headshot":  {"target_y_norm": 0.91, "dist_norm": 0.80, "fov_deg": 24.0},
    "bust":      {"target_y_norm": 0.74, "dist_norm": 1.20, "fov_deg": 27.0},
}

VALID_SIZES = {48, 60, 75, 100, 110, 150, 180, 352, 420, 720}


# ─────────────────────────────────────────────────────────────────────────────
#  Colour helpers
# ─────────────────────────────────────────────────────────────────────────────

def hex_to_rgb(h: str) -> Tuple[int, int, int]:
    h = (h or "#D9D9D9").lstrip("#")
    if len(h) == 3:
        h = h[0]*2 + h[1]*2 + h[2]*2
    try:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except Exception:
        return 0xD9, 0xD9, 0xD9


def hex_to_float4(h: str) -> np.ndarray:
    r, g, b = hex_to_rgb(h)
    return np.array([r/255.0, g/255.0, b/255.0, 1.0], dtype=np.float32)


def part_hex(part_name: str, body_hex: str, slot_colors: dict) -> str:
    slot = PART_SLOTS.get(part_name)
    if slot:
        d = slot_colors.get(slot)
        if d and d.get("primary"):
            return d["primary"]
    return body_hex


# ─────────────────────────────────────────────────────────────────────────────
#  OBJ parser  — manual, so each named 'o' group becomes its own Trimesh
# ─────────────────────────────────────────────────────────────────────────────

class OBJParser:
    """
    Parses an OBJ file and returns one trimesh.Trimesh per named 'o' group.
    trimesh.load() merges all groups into one mesh (or one Scene geometry key)
    when they share a single material — this parser preserves the split.
    """

    def __init__(self, path: str):
        self.path    = path
        self._parsed: Optional[Dict[str, "trimesh.Trimesh"]] = None
        # Bounding info per part (raw OBJ coordinates, before any normalisation)
        self.bounds: Dict[str, np.ndarray] = {}  # name → (2,3) array [[min],[max]]

    def parse(self) -> Dict[str, "trimesh.Trimesh"]:
        if self._parsed is not None:
            return self._parsed
        if not PYRENDER_OK:
            self._parsed = {}
            return {}
        if not os.path.exists(self.path):
            log.error("OBJ not found: %s", self.path)
            self._parsed = {}
            return {}

        try:
            self._parsed = self._do_parse()
            log.info("OBJ parsed: %d parts [%s]", len(self._parsed), list(self._parsed.keys()))
        except Exception as e:
            log.error("OBJ parse failed: %s", e)
            self._parsed = {}
        return self._parsed

    def _do_parse(self) -> Dict[str, "trimesh.Trimesh"]:
        vertices: List[np.ndarray] = []
        groups: Dict[str, List[List[int]]] = {}
        current = "__default__"

        with open(self.path, encoding="utf-8", errors="ignore") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                tok = line.split()
                cmd = tok[0]
                if cmd == "v":
                    vertices.append([float(tok[1]), float(tok[2]), float(tok[3])])
                elif cmd == "o":
                    current = tok[1] if len(tok) > 1 else "__default__"
                    if current not in groups:
                        groups[current] = []
                elif cmd == "f":
                    # Each token: v or v/vt or v/vt/vn (1-based)
                    face = []
                    for t in tok[1:]:
                        idx = int(t.split("/")[0]) - 1
                        face.append(idx)
                    # Triangulate (fan method)
                    for i in range(1, len(face) - 1):
                        groups[current].append([face[0], face[i], face[i+1]])

        if not vertices:
            return {}

        verts_np = np.array(vertices, dtype=np.float64)
        result   = {}

        for name, face_list in groups.items():
            if not face_list:
                continue
            faces    = np.array(face_list, dtype=np.int32)
            used_idx = np.unique(faces)

            # Remap to local vertex indices
            remap        = {old: new for new, old in enumerate(used_idx)}
            local_verts  = verts_np[used_idx].copy()
            local_faces  = np.array([[remap[i] for i in f] for f in face_list], dtype=np.int32)

            mesh = trimesh.Trimesh(
                vertices=local_verts,
                faces=local_faces,
                process=False,
            )
            mesh.fix_normals()
            result[name] = mesh
            self.bounds[name] = np.array([local_verts.min(0), local_verts.max(0)])

        return result


# Singleton parser — loaded once per process
_obj_parser = OBJParser("")


# ─────────────────────────────────────────────────────────────────────────────
#  3-D scene builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_pyrender_scene(
    body_hex: str,
    slot_colors: dict,
    y_rot_deg: float = 0.0,
) -> Tuple["Scene", float, dict]:
    """
    Build a pyrender Scene from the OBJ parts with per-part colours applied.

    Returns
    -------
    scene         : pyrender.Scene
    model_height  : height of the normalised model (always 1.0)
    part_bounds   : {part_name: {"y_min","y_max","cx","cz"}} in normalised units
    """
    parts      = _obj_parser.parse()
    raw_bounds = _obj_parser.bounds  # raw OBJ Y values

    scene = Scene(
        bg_color=np.array([0.0, 0.0, 0.0, 0.0]),   # transparent bg
        ambient_light=np.array([0.50, 0.50, 0.50, 1.0]),
    )

    if not parts:
        return scene, 1.0, {}

    # Compute global normalisation: translate so min-Y=0, scale to height=1
    all_verts   = np.vstack([m.vertices for m in parts.values()])
    g_min       = all_verts.min(0)
    g_max       = all_verts.max(0)
    raw_h       = g_max[1] - g_min[1]
    scale       = 1.0 / raw_h if raw_h > 0 else 1.0

    # Y-rotation matrix (character spins around its vertical axis)
    ang  = np.deg2rad(y_rot_deg)
    Ry   = np.array([
        [ np.cos(ang), 0, np.sin(ang), 0],
        [ 0,           1, 0,           0],
        [-np.sin(ang), 0, np.cos(ang), 0],
        [ 0,           0, 0,           1],
    ], dtype=float)

    part_bounds_norm: dict = {}

    for part_name, raw_mesh in parts.items():
        # Normalise vertex positions: translate so feet=0, scale height to 1.0
        verts = raw_mesh.vertices.copy()
        verts -= g_min                  # translate so Y-min = 0
        verts *= scale                  # scale height to 1.0

        norm_mesh = trimesh.Trimesh(
            vertices=verts,
            faces=raw_mesh.faces.copy(),
            process=False,
        )
        norm_mesh.fix_normals()

        # Apply hex colour as vertex colours (RGBA uint8)
        hex_col      = part_hex(part_name, body_hex, slot_colors)
        r, g_c, b    = hex_to_rgb(hex_col)
        vertex_colors = np.tile(
            np.array([[r, g_c, b, 255]], dtype=np.uint8),
            (len(norm_mesh.vertices), 1)
        )
        norm_mesh.visual = trimesh.visual.ColorVisuals(
            mesh=norm_mesh,
            vertex_colors=vertex_colors,
        )

        pr_mesh = Mesh.from_trimesh(norm_mesh, smooth=True)
        node    = Node(mesh=pr_mesh, matrix=Ry)
        scene.add_node(node)

        # Store normalised bounding info
        bmin = verts.min(0)
        bmax = verts.max(0)
        part_bounds_norm[part_name] = {
            "y_min": float(bmin[1]),
            "y_max": float(bmax[1]),
            "cx":    float((bmin[0]+bmax[0])/2),
            "cz":    float((bmin[2]+bmax[2])/2),
        }

    # ── Lighting (3-point rig, same as Roblox's thumbnail renderer) ───────────
    # Key light (upper right front)
    key = DirectionalLight(color=np.ones(3), intensity=4.0)
    key_pose        = np.eye(4)
    key_pose[:3, 3] = [1.0, 2.0, 2.5]
    scene.add(key, pose=key_pose)

    # Fill light (left, softer)
    fill = DirectionalLight(color=np.ones(3), intensity=2.0)
    fill_pose        = np.eye(4)
    fill_pose[:3, 3] = [-1.5, 1.0, 1.5]
    scene.add(fill, pose=fill_pose)

    # Rim / back light (adds depth separation)
    rim = DirectionalLight(color=np.ones(3), intensity=1.0)
    rim_pose        = np.eye(4)
    rim_pose[:3, 3] = [0.0, 0.5, -2.0]
    scene.add(rim, pose=rim_pose)

    return scene, 1.0, part_bounds_norm


def _add_hat(
    scene: "Scene",
    part_bounds: dict,
    slot_colors: dict,
    y_rot_deg: float,
) -> None:
    """
    Add a hat on top of the head, positioned exactly at head's Y-max.
    The hat rotates with the character via the same Ry matrix.
    """
    hat = slot_colors.get("hat")
    if not hat or "head" not in part_bounds:
        return

    hb    = part_bounds["head"]
    top_y = hb["y_max"]        # exactly the top of the head geometry
    cx    = hb["cx"]
    cz    = hb["cz"]

    head_h  = hb["y_max"] - hb["y_min"]
    hat_h   = head_h * 0.85
    hat_w   = head_h * 0.90
    hat_d   = head_h * 0.90

    ang = np.deg2rad(y_rot_deg)
    Ry  = np.array([
        [ np.cos(ang), 0, np.sin(ang), 0],
        [ 0,           1, 0,           0],
        [-np.sin(ang), 0, np.cos(ang), 0],
        [ 0,           0, 0,           1],
    ], dtype=float)

    def _add_box(extents, center, hex_col):
        box   = trimesh.creation.box(extents=extents)
        verts = box.vertices.copy()
        verts += np.array(center)
        m2    = trimesh.Trimesh(vertices=verts, faces=box.faces.copy(), process=False)
        m2.fix_normals()
        r, g_, b = hex_to_rgb(hex_col)
        vc = np.tile(np.array([[r, g_, b, 255]], dtype=np.uint8), (len(m2.vertices), 1))
        m2.visual = trimesh.visual.ColorVisuals(mesh=m2, vertex_colors=vc)
        pr_m = Mesh.from_trimesh(m2, smooth=False)
        scene.add(Node(mesh=pr_m, matrix=Ry))

    # Crown — placed exactly at head top
    _add_box(
        extents=[hat_w, hat_h, hat_d],
        center=[cx, top_y + hat_h / 2.0, cz],
        hex_col=hat.get("primary", "#888888"),
    )
    # Brim
    _add_box(
        extents=[hat_w * 1.55, hat_h * 0.10, hat_d * 1.55],
        center=[cx, top_y + hat_h * 0.04, cz],
        hex_col=hat.get("secondary") or hat.get("primary", "#666666"),
    )


def _add_shoes(
    scene: "Scene",
    part_bounds: dict,
    slot_colors: dict,
    y_rot_deg: float,
) -> None:
    shoe = slot_colors.get("shoes")
    if not shoe:
        return

    ang = np.deg2rad(y_rot_deg)
    Ry  = np.array([[ np.cos(ang), 0, np.sin(ang), 0], [0,1,0,0], [-np.sin(ang), 0, np.cos(ang), 0], [0,0,0,1]], dtype=float)

    for leg_name in ("left_leg", "right_leg"):
        if leg_name not in part_bounds:
            continue
        b    = part_bounds[leg_name]
        lw   = abs(b["cx"]) * 0.6   # approximate width
        sh_h = lw * 0.55
        box  = trimesh.creation.box(extents=[lw * 1.1, sh_h, lw * 1.6])
        verts = box.vertices.copy()
        verts += np.array([b["cx"], b["y_min"] + sh_h / 2, b["cz"] + lw * 0.25])
        m2 = trimesh.Trimesh(vertices=verts, faces=box.faces.copy(), process=False)
        m2.fix_normals()
        r, g_, bv = hex_to_rgb(shoe.get("primary", "#444444"))
        vc = np.tile(np.array([[r, g_, bv, 255]], dtype=np.uint8), (len(m2.vertices), 1))
        m2.visual = trimesh.visual.ColorVisuals(mesh=m2, vertex_colors=vc)
        scene.add(Node(mesh=Mesh.from_trimesh(m2, smooth=False), matrix=Ry))


def _add_accessory(
    scene: "Scene",
    part_bounds: dict,
    slot_colors: dict,
    y_rot_deg: float,
) -> None:
    acc = slot_colors.get("accessory")
    if not acc or "right_arm" not in part_bounds:
        return

    b    = part_bounds["right_arm"]
    r_g  = (b["y_max"] - b["y_min"]) * 0.20
    gem  = trimesh.creation.icosphere(subdivisions=2, radius=r_g)
    verts = gem.vertices.copy()
    arm_cx = b["cx"]
    arm_cz = b["cz"]
    # Place to the outside of the right arm
    verts += np.array([arm_cx - r_g * 2.5, (b["y_min"]+b["y_max"])/2, arm_cz])
    m2 = trimesh.Trimesh(vertices=verts, faces=gem.faces.copy(), process=False)
    m2.fix_normals()
    r2, g2, b2 = hex_to_rgb(acc.get("primary","#aaaaaa"))
    vc = np.tile(np.array([[r2, g2, b2, 255]], dtype=np.uint8), (len(m2.vertices), 1))
    m2.visual = trimesh.visual.ColorVisuals(mesh=m2, vertex_colors=vc)
    ang = np.deg2rad(y_rot_deg)
    Ry  = np.array([[np.cos(ang),0,np.sin(ang),0],[0,1,0,0],[-np.sin(ang),0,np.cos(ang),0],[0,0,0,1]], dtype=float)
    scene.add(Node(mesh=Mesh.from_trimesh(m2, smooth=True), matrix=Ry))


# ─────────────────────────────────────────────────────────────────────────────
#  Camera positioning
# ─────────────────────────────────────────────────────────────────────────────

def _make_camera_pose(
    target_y: float,
    dist: float,
    y_rot_deg: float = 0.0,
) -> np.ndarray:
    """
    Position the camera on the Z+ axis looking at (cx, target_y, cz) of the character.
    Applies an optional horizontal orbit (y_rot_deg of the camera, independent of character rotation).
    """
    # Character centre X/Z in normalised space
    all_parts  = _obj_parser.parse()
    if all_parts:
        all_v = np.vstack([m.vertices for m in all_parts.values()])
        g_min = all_v.min(0);  g_max = all_v.max(0)
        raw_h = g_max[1] - g_min[1]
        scale = 1.0 / max(raw_h, 1e-6)
        cx = ((g_min[0]+g_max[0])/2 - g_min[0]) * scale
        cz = ((g_min[2]+g_max[2])/2 - g_min[2]) * scale
    else:
        cx = cz = 0.0

    cam_x = cx + dist * np.sin(0)   # camera at Z+ by default
    cam_z = cz + dist
    cam_y = target_y

    # Look-at matrix: camera at (cam_x, cam_y, cam_z) looking at (cx, target_y, cz)
    eye    = np.array([cam_x, cam_y, cam_z], dtype=float)
    target = np.array([cx,    target_y,  cz], dtype=float)
    up     = np.array([0.0,   1.0,   0.0], dtype=float)

    fwd = target - eye
    if np.linalg.norm(fwd) < 1e-8:
        fwd = np.array([0, 0, -1], dtype=float)
    fwd = fwd / np.linalg.norm(fwd)

    right = np.cross(fwd, up)
    if np.linalg.norm(right) < 1e-8:
        right = np.array([1, 0, 0], dtype=float)
    right = right / np.linalg.norm(right)

    up2 = np.cross(right, fwd)

    pose = np.eye(4)
    pose[:3, 0] = right
    pose[:3, 1] = up2
    pose[:3, 2] = -fwd   # OpenGL convention: camera looks along -Z
    pose[:3, 3] = eye
    return pose


# ─────────────────────────────────────────────────────────────────────────────
#  Core render function
# ─────────────────────────────────────────────────────────────────────────────

def render_avatar_3d(
    body_hex: str,
    slot_colors: dict,
    thumbnail_type: str = "full_body",
    size: int = 420,
    fov_deg: Optional[float] = None,
    y_rot_deg: float = 0.0,
    distance_scale: float = 1.0,
    bg_color: Optional[str] = None,
) -> bytes:
    """
    Render a 3-D avatar thumbnail.

    Parameters
    ----------
    body_hex        : Skin/body hex colour e.g. '#D9D9D9'
    slot_colors     : {'hat': {'primary': '#...', 'secondary': '#...'}, ...}
    thumbnail_type  : 'full_body' | 'headshot' | 'bust'
    size            : Output pixel size (square). Clamped to VALID_SIZES.
    fov_deg         : Vertical FOV override (15–60). None = use preset default.
    y_rot_deg       : Character Y rotation (-60 to 60).
    distance_scale  : Multiply base camera distance (0.5–4.0).
    bg_color        : Background hex colour. None/'transparent' = transparent.

    Returns
    -------
    PNG image bytes.
    """
    if not PYRENDER_OK:
        return _pil_fallback_avatar(body_hex, slot_colors, size)

    size = _clamp_size(size)
    thumb_type = thumbnail_type if thumbnail_type in CAMERA_PRESETS else "full_body"
    preset     = CAMERA_PRESETS[thumb_type]

    fov    = float(np.clip(fov_deg if fov_deg is not None else preset["fov_deg"], 10, 70))
    dscale = float(np.clip(distance_scale, 0.3, 5.0))
    dist   = preset["dist_norm"] * dscale

    y_rot  = float(np.clip(y_rot_deg, -90, 90))

    try:
        with _render_lock:
            return _do_render(
                body_hex, slot_colors, thumb_type, preset,
                size, fov, dist, y_rot, bg_color,
            )
    except Exception as exc:
        log.error("render_avatar_3d failed: %s", exc, exc_info=True)
        return _pil_fallback_avatar(body_hex, slot_colors, size)


def _do_render(
    body_hex, slot_colors, thumb_type, preset,
    size, fov, dist, y_rot, bg_color,
) -> bytes:
    # 1. Build scene
    scene, model_h, part_bounds = _build_pyrender_scene(body_hex, slot_colors, y_rot)

    # 2. Add accessories (hat, shoes, accessory gem)
    _add_hat(scene, part_bounds, slot_colors, y_rot)
    _add_shoes(scene, part_bounds, slot_colors, y_rot)
    _add_accessory(scene, part_bounds, slot_colors, y_rot)

    # 3. Camera
    target_y   = preset["target_y_norm"] * model_h
    cam_pose   = _make_camera_pose(target_y, dist, y_rot)
    camera     = PerspectiveCamera(yfov=np.deg2rad(fov), aspectRatio=1.0)
    scene.add(camera, pose=cam_pose)

    # 4. Render at 2× resolution then downscale (SSAA anti-aliasing)
    render_sz = min(size * 2, 1440)
    r = OffscreenRenderer(viewport_width=render_sz, viewport_height=render_sz)
    try:
        flags = RenderFlags.RGBA | RenderFlags.SHADOWS_DIRECTIONAL
        color, _depth = r.render(scene, flags=flags)
    finally:
        r.delete()

    # 5. Post-process
    img = Image.fromarray(color, "RGBA")

    # Composite background
    if bg_color and bg_color.lower() != "transparent":
        bg = Image.new("RGBA", img.size, hex_to_rgb(bg_color) + (255,))
        bg.paste(img, mask=img.split()[3])
        img = bg.convert("RGB")
    else:
        # Keep transparency but trim tight to non-transparent pixels
        img = _autocrop_with_padding(img, pad_frac=0.05)

    # Downsample to requested size with high-quality Lanczos filter
    img = img.resize((size, size), Image.LANCZOS)

    buf = BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def render_item_3d(
    color_primary: str,
    color_secondary: str,
    category: str,
    size: int = 420,
    bg_color: Optional[str] = None,
) -> bytes:
    """Render a 3-D item thumbnail using a simple geometric preview."""
    if not PYRENDER_OK:
        return _pil_fallback_item(color_primary, color_secondary, category, size)

    size = _clamp_size(size)
    try:
        with _render_lock:
            return _do_render_item(color_primary, color_secondary, category, size, bg_color)
    except Exception as exc:
        log.error("render_item_3d failed: %s", exc)
        return _pil_fallback_item(color_primary, color_secondary, category, size)


def _do_render_item(c1, c2, category, size, bg_color) -> bytes:
    scene = Scene(
        bg_color=np.array([0.0, 0.0, 0.0, 0.0]),
        ambient_light=np.array([0.55, 0.55, 0.55, 1.0]),
    )

    def _mesh(tm, hex_c):
        r, g_, b = hex_to_rgb(hex_c)
        vc = np.tile(np.array([[r, g_, b, 255]], dtype=np.uint8), (len(tm.vertices), 1))
        tm.visual = trimesh.visual.ColorVisuals(mesh=tm, vertex_colors=vc)
        tm.fix_normals()
        return Mesh.from_trimesh(tm, smooth=True)

    ITEM_SHAPES = {
        "hat": [
            (trimesh.creation.box(extents=[0.55, 0.55, 0.55]), c1),
            (trimesh.creation.box(extents=[0.85, 0.08, 0.85]), c2),
        ],
        "shirt": [
            (trimesh.creation.box(extents=[0.70, 0.55, 0.30]), c1),
            (trimesh.creation.box(extents=[0.20, 0.45, 0.30]), c2),
        ],
        "pants": [
            (trimesh.creation.cylinder(radius=0.22, height=0.60, sections=24), c1),
            (trimesh.creation.cylinder(radius=0.22, height=0.60, sections=24), c1),
        ],
        "shoes": [
            (trimesh.creation.box(extents=[0.30, 0.15, 0.55]), c1),
            (trimesh.creation.box(extents=[0.30, 0.08, 0.55]), c2),
        ],
        "face":  [
            (trimesh.creation.icosphere(subdivisions=3, radius=0.40), c1),
        ],
        "accessory": [
            (trimesh.creation.icosahedron(radius=0.38), c1),
        ],
    }

    shapes   = ITEM_SHAPES.get(category, [(trimesh.creation.box(extents=[0.60, 0.60, 0.60]), c1)])
    offsets  = {
        "hat":       [(0, 0.28, 0), (0, -0.24, 0)],
        "shirt":     [(0, 0.22, 0), (0, -0.04, 0)],
        "pants":     [(-0.25, 0, 0), (0.25, 0, 0)],
        "shoes":     [(0, 0.06, 0), (0, -0.06, 0)],
        "face":      [(0, 0, 0)],
        "accessory": [(0, 0, 0)],
    }
    offlist = offsets.get(category, [(0,0,0)])

    for i, (tm, col) in enumerate(shapes):
        off = offlist[i] if i < len(offlist) else (0,0,0)
        tm.vertices += np.array(off)
        scene.add(Node(mesh=_mesh(tm, col)))

    # Lights
    for pos, inten in [([1.5,2,2.5], 3.0), ([-1,1,2], 1.5), ([0,0.5,-2], 0.8)]:
        dl   = DirectionalLight(color=np.ones(3), intensity=inten)
        pose = np.eye(4); pose[:3,3] = pos
        scene.add(dl, pose=pose)

    # Camera
    cam_pose = np.eye(4)
    cam_pose[2, 3] = 2.0     # camera on Z+ axis
    cam_pose[1, 3] = 0.12    # slightly above centre
    scene.add(PerspectiveCamera(yfov=np.deg2rad(32), aspectRatio=1.0), pose=cam_pose)

    render_sz = min(size * 2, 840)
    r = OffscreenRenderer(viewport_width=render_sz, viewport_height=render_sz)
    try:
        color, _ = r.render(scene, flags=RenderFlags.RGBA | RenderFlags.SHADOWS_DIRECTIONAL)
    finally:
        r.delete()

    img = Image.fromarray(color, "RGBA")
    if bg_color and bg_color.lower() != "transparent":
        bg = Image.new("RGBA", img.size, hex_to_rgb(bg_color) + (255,))
        bg.paste(img, mask=img.split()[3])
        img = bg.convert("RGB")
    else:
        img = _autocrop_with_padding(img, pad_frac=0.10)

    img = img.resize((size, size), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, "PNG", optimize=True)
    return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
#  Image post-processing helpers
# ─────────────────────────────────────────────────────────────────────────────

def _autocrop_with_padding(img: Image.Image, pad_frac: float = 0.05) -> Image.Image:
    """
    Crop tight around non-transparent pixels then add proportional padding.
    Returns a square image.
    """
    if img.mode != "RGBA":
        return img
    alpha = np.array(img.split()[3])
    rows  = np.any(alpha > 0, axis=1)
    cols  = np.any(alpha > 0, axis=0)
    if not rows.any():
        return img
    rmin, rmax = np.where(rows)[0][[0, -1]]
    cmin, cmax = np.where(cols)[0][[0, -1]]

    h, w   = img.size[1], img.size[0]
    pad    = int(max(rmax-rmin, cmax-cmin) * pad_frac)
    rmin   = max(0, rmin - pad);  rmax = min(h, rmax + pad)
    cmin   = max(0, cmin - pad);  cmax = min(w, cmax + pad)

    # Make square by expanding the shorter dimension
    ch = rmax - rmin;  cw = cmax - cmin
    if ch > cw:
        diff = ch - cw;  cmin = max(0, cmin - diff//2);  cmax = min(w, cmin + ch)
    elif cw > ch:
        diff = cw - ch;  rmin = max(0, rmin - diff//2);  rmax = min(h, rmin + cw)

    return img.crop((cmin, rmin, cmax, rmax))


def _clamp_size(size: int) -> int:
    closest = min(VALID_SIZES, key=lambda s: abs(s - size))
    return closest


# ─────────────────────────────────────────────────────────────────────────────
#  PIL fallback renderers  (used when pyrender is unavailable)
# ─────────────────────────────────────────────────────────────────────────────

def _pil_fallback_avatar(body_hex: str, slot_colors: dict, size: int) -> bytes:
    sz   = size
    img  = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    bc   = hex_to_rgb(body_hex)

    def sc(slot): d=slot_colors.get(slot); return hex_to_rgb(d["primary"]) if d else bc
    def px(f): return int(sz * f)

    shirt_c, pants_c, shoe_c = sc("shirt"), sc("pants"), sc("shoes")
    head_c = sc("face") if slot_colors.get("face") else bc

    draw.rectangle([px(.33),px(.27),px(.67),px(.58)], fill=shirt_c)
    draw.rectangle([px(.18),px(.27),px(.33),px(.56)], fill=shirt_c)
    draw.rectangle([px(.67),px(.27),px(.82),px(.56)], fill=shirt_c)
    draw.rectangle([px(.33),px(.58),px(.49),px(.90)], fill=pants_c)
    draw.rectangle([px(.51),px(.58),px(.67),px(.90)], fill=pants_c)
    draw.rectangle([px(.31),px(.87),px(.50),px(.94)], fill=shoe_c)
    draw.rectangle([px(.50),px(.87),px(.69),px(.94)], fill=shoe_c)

    HR = px(.13); HX, HY = sz//2, px(.13)
    draw.ellipse([HX-HR,HY-HR,HX+HR,HY+HR], fill=head_c)
    draw.rectangle([px(.44),px(.26),px(.56),px(.28)], fill=bc)

    hat = slot_colors.get("hat")
    if hat:
        hc  = hex_to_rgb(hat.get("primary","#888")); bc2 = hex_to_rgb(hat.get("secondary") or hat.get("primary","#666"))
        hatW=int(HR*1.6); hatH=int(HR*1.1)
        draw.rectangle([HX-hatW//2,HY-HR-hatH,HX+hatW//2,HY-HR], fill=hc)
        draw.rectangle([HX-int(HR*2.1)//2,HY-HR-int(hatH*.1),HX+int(HR*2.1)//2,HY-HR+int(hatH*.12)], fill=bc2)

    buf = BytesIO(); img.save(buf, "PNG", optimize=True); return buf.getvalue()


def _pil_fallback_item(c1, c2, category, size) -> bytes:
    sz = size; img = Image.new("RGBA",(sz,sz),(0,0,0,0)); draw=ImageDraw.Draw(img)
    r1=hex_to_rgb(c1); r2=hex_to_rgb(c2); H,Q=sz//2,sz//4
    if category=="hat":
        draw.rectangle([Q,Q,3*Q,H+Q//3],fill=r1); draw.rectangle([Q//2,H-Q//8,7*Q//2,H+Q//4],fill=r2)
    elif category in("shirt","gear"):
        draw.rectangle([Q,Q,3*Q,3*Q],fill=r1); draw.rectangle([Q//2,Q,Q,3*Q],fill=r2); draw.rectangle([3*Q,Q,7*Q//2,3*Q],fill=r2)
    elif category=="pants":
        draw.rectangle([Q,Q,H,3*Q],fill=r1); draw.rectangle([H,Q,3*Q,3*Q],fill=r1); draw.line([H,Q,H,3*Q],fill=r2,width=max(3,sz//100))
    elif category=="shoes":
        draw.ellipse([Q,H,3*Q,H+Q],fill=r1); draw.rectangle([Q,H,3*Q,H+Q//2],fill=r2)
    elif category=="face":
        draw.ellipse([Q,Q,3*Q,3*Q],fill=r1); er=max(5,sz//40); ey=H-Q//4
        draw.ellipse([H-Q//2-er,ey-er,H-Q//2+er,ey+er],fill=r2); draw.ellipse([H+Q//4-er,ey-er,H+Q//4+er,ey+er],fill=r2)
    elif category=="accessory":
        draw.polygon([H,Q,3*Q,H,H,3*Q,Q,H],fill=r1,outline=r2)
    else:
        draw.rectangle([Q,Q,3*Q,3*Q],fill=r1); draw.rectangle([Q+8,Q+8,3*Q-8,3*Q-8],outline=r2,width=max(4,sz//80))
    buf=BytesIO(); img.save(buf,"PNG",optimize=True); return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
#  LRU cache + disk cache
# ─────────────────────────────────────────────────────────────────────────────

class LRUCache:
    def __init__(self, maxsize=512):
        self._d: OrderedDict[str,bytes] = OrderedDict()
        self._max = maxsize
        self._lk  = threading.Lock()
        self._h = self._m = 0

    def get(self, k) -> Optional[bytes]:
        with self._lk:
            if k not in self._d: self._m += 1; return None
            self._d.move_to_end(k); self._h += 1; return self._d[k]

    def set(self, k, v):
        with self._lk:
            if k in self._d: self._d.move_to_end(k)
            self._d[k] = v
            if len(self._d) > self._max: self._d.popitem(last=False)

    def stats(self): return {"hits":self._h,"misses":self._m,"size":len(self._d)}


_mem_cache: Optional[LRUCache] = None


def _cache_key(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()[:24]


def _thumb_dir() -> Path:
    p = Path(CFG["output_dir"]) / "thumbnails"
    p.mkdir(parents=True, exist_ok=True)
    return p


def _from_disk(fname: str) -> Optional[bytes]:
    p = _thumb_dir() / fname
    return p.read_bytes() if p.exists() else None


def _to_disk(png: bytes, fname: str) -> str:
    (_thumb_dir() / fname).write_bytes(png)
    return f"/storage/thumbnails/{fname}"


def _render_avatar_cached(body_hex, slot_colors, thumbnail_type, size, fov_deg, y_rot_deg, distance_scale, bg_color, user_id, do_save):
    payload = {"bc":body_hex,"sc":slot_colors,"tt":thumbnail_type,"sz":size,"fov":fov_deg,"yr":y_rot_deg,"ds":distance_scale,"bg":bg_color}
    ck   = _cache_key(payload)
    fn   = f"avatar_{ck}_{size}.png"

    disk = _from_disk(fn)
    if disk:
        return {"url": f"/storage/thumbnails/{fn}", "cache": "disk"} if do_save else {"base64": base64.b64encode(disk).decode(), "cache": "disk"}

    mem = _mem_cache.get(ck) if _mem_cache else None
    if mem:
        url = _to_disk(mem, fn) if do_save else None
        return {"url": url, "cache": "mem"} if do_save else {"base64": base64.b64encode(mem).decode(), "cache": "mem"}

    t0  = time.time()
    png = render_avatar_3d(body_hex, slot_colors, thumbnail_type, size, fov_deg, y_rot_deg, distance_scale, bg_color)
    log.info("rendered %s %dpx user=%s in %.3fs renderer=%s", thumbnail_type, size, user_id or "anon", time.time()-t0, "3D" if PYRENDER_OK else "PIL")

    if _mem_cache: _mem_cache.set(ck, png)
    if do_save:    return {"url": _to_disk(png, fn), "cache": "render"}
    return {"base64": base64.b64encode(png).decode(), "cache": "render"}


def _render_item_cached(c1, c2, category, size, bg_color, item_id, do_save):
    payload = {"c1":c1,"c2":c2,"cat":category,"sz":size,"bg":bg_color}
    ck   = _cache_key(payload)
    fn   = f"item_{ck}_{size}.png"

    disk = _from_disk(fn)
    if disk:
        return {"url": f"/storage/thumbnails/{fn}", "cache": "disk"} if do_save else {"base64": base64.b64encode(disk).decode(), "cache": "disk"}

    png = render_item_3d(c1, c2, category, size, bg_color)
    if _mem_cache: _mem_cache.set(ck, png)
    if do_save:    return {"url": _to_disk(png, fn), "cache": "render"}
    return {"base64": base64.b64encode(png).decode(), "cache": "render"}


# ─────────────────────────────────────────────────────────────────────────────
#  DB helper
# ─────────────────────────────────────────────────────────────────────────────

_db_engine = None
_db_lk     = threading.Lock()

def _get_engine():
    global _db_engine
    if _db_engine or not DB_OK or not CFG.get("db_url"): return _db_engine
    with _db_lk:
        if _db_engine: return _db_engine
        try: _db_engine = create_engine(CFG["db_url"], pool_pre_ping=True, pool_size=3, max_overflow=5)
        except Exception as e: log.error("DB engine failed: %s", e)
    return _db_engine

def fetch_avatar_from_db(user_id: int) -> Optional[dict]:
    eng = _get_engine()
    if not eng: return None
    try:
        with eng.connect() as conn:
            row = conn.execute(sa_text("""
                SELECT a.body_color,
                       hi.color_primary AS hat_p, hi.color_secondary AS hat_s,
                       fi.color_primary AS face_p,
                       si.color_primary AS shirt_p,
                       pi.color_primary AS pants_p,
                       soi.color_primary AS shoes_p,
                       ai.color_primary AS acc_p
                FROM avatars a
                LEFT JOIN user_items ui_h  ON ui_h.id  = a.hat_user_item_id
                LEFT JOIN items hi  ON hi.id  = ui_h.item_id
                LEFT JOIN user_items ui_f  ON ui_f.id  = a.face_user_item_id
                LEFT JOIN items fi  ON fi.id  = ui_f.item_id
                LEFT JOIN user_items ui_s  ON ui_s.id  = a.shirt_user_item_id
                LEFT JOIN items si  ON si.id  = ui_s.item_id
                LEFT JOIN user_items ui_p  ON ui_p.id  = a.pants_user_item_id
                LEFT JOIN items pi  ON pi.id  = ui_p.item_id
                LEFT JOIN user_items ui_so ON ui_so.id = a.shoes_user_item_id
                LEFT JOIN items soi ON soi.id = ui_so.item_id
                LEFT JOIN user_items ui_a  ON ui_a.id  = a.accessory_user_item_id
                LEFT JOIN items ai  ON ai.id  = ui_a.item_id
                WHERE a.user_id = :uid LIMIT 1
            """), {"uid": user_id}).fetchone()
        if not row: return None
        def _s(p,s=None): return {"primary":p,"secondary":s} if p else None
        return {"body_color": row.body_color or "#D9D9D9", "slot_colors": {
            "hat":       _s(row.hat_p,  row.hat_s),
            "face":      _s(row.face_p),
            "shirt":     _s(row.shirt_p),
            "pants":     _s(row.pants_p),
            "shoes":     _s(row.shoes_p),
            "accessory": _s(row.acc_p),
        }}
    except Exception as e: log.error("fetch_avatar_db(%d): %s", user_id, e); return None


def _slot_colors_from_body(body: dict) -> dict:
    if "slot_colors" in body: return body["slot_colors"]
    out = {}
    for slot in ("hat","face","shirt","pants","shoes","accessory"):
        p = body.get(f"{slot}_primary") or body.get(f"{slot}_color")
        if p: out[slot] = {"primary": p, "secondary": body.get(f"{slot}_secondary")}
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Flask routes  — Roblox-style API
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/health")
def health():
    return jsonify({
        "status":     "ok",
        "pid":        os.getpid(),
        "renderer":   "pyrender_3d" if PYRENDER_OK else "pil_2d",
        "obj_loaded": bool(_obj_parser.parse()),
        "obj_parts":  list(_obj_parser.parse().keys()),
        "numpy":      np.__version__,
        "cache":      _mem_cache.stats() if _mem_cache else None,
        "ts":         int(time.time()),
    })


@app.route("/render/avatar", methods=["POST"])
def render_avatar_ep():
    """
    Render an avatar thumbnail.

    Body (JSON):
      body_color      : hex   e.g. "#D9D9D9"
      slot_colors     : {hat:{primary,secondary}, shirt:{primary}, ...}
      thumbnail_type  : "full_body" | "headshot" | "bust"  (default: full_body)
      size            : int  e.g. 420  (default: 420)
      fov_deg         : float 15–60  (optional, overrides preset)
      y_rot_deg       : float -60 to 60  (default: 0)
      distance_scale  : float 0.5–4  (default: 1.0)
      bg_color        : hex or "transparent"  (default: transparent)
      user_id         : int  (optional, for cache keying)
      save            : bool  (default: true — save to disk, return URL)
    """
    body        = request.get_json(force=True, silent=True) or {}
    body_hex    = body.get("body_color", "#D9D9D9")
    slot_colors = _slot_colors_from_body(body)
    thumb_type  = body.get("thumbnail_type", "full_body")
    size        = int(body.get("size", 420))
    fov_deg     = body.get("fov_deg")
    y_rot       = float(body.get("y_rot_deg", 0))
    d_scale     = float(body.get("distance_scale", 1.0))
    bg          = body.get("bg_color")
    user_id     = body.get("user_id")
    do_save     = body.get("save", True)

    result = _render_avatar_cached(body_hex, slot_colors, thumb_type, size, fov_deg, y_rot, d_scale, bg, user_id, do_save)
    return jsonify(result)


@app.route("/render/avatar/headshot", methods=["POST"])
def render_headshot():
    """Shortcut — always returns a headshot thumbnail."""
    body        = request.get_json(force=True, silent=True) or {}
    body["thumbnail_type"] = "headshot"
    body["size"]           = body.get("size", 420)
    with app.test_request_context("/render/avatar", method="POST", json=body):
        return render_avatar_ep()


@app.route("/render/avatar/bust", methods=["POST"])
def render_bust():
    """Shortcut — always returns a bust thumbnail."""
    body        = request.get_json(force=True, silent=True) or {}
    body["thumbnail_type"] = "bust"
    with app.test_request_context("/render/avatar", method="POST", json=body):
        return render_avatar_ep()


@app.route("/render/item", methods=["POST"])
def render_item_ep():
    """
    Render an item thumbnail.

    Body (JSON):
      color_primary   : hex
      color_secondary : hex
      category        : hat|face|shirt|pants|shoes|accessory|gear
      size            : int  (default: 420)
      bg_color        : hex or "transparent"
      item_id         : int (optional)
      save            : bool
    """
    body    = request.get_json(force=True, silent=True) or {}
    c1      = body.get("color_primary",   "#6366f1")
    c2      = body.get("color_secondary", "#4338ca")
    cat     = body.get("category",        "gear")
    size    = int(body.get("size", 420))
    bg      = body.get("bg_color")
    item_id = body.get("item_id")
    do_save = body.get("save", True)
    result  = _render_item_cached(c1, c2, cat, size, bg, item_id, do_save)
    return jsonify(result)


@app.route("/fetch/avatar/<int:user_id>")
def fetch_avatar(user_id: int):
    """Return stored avatar config for a user (DB lookup)."""
    data = fetch_avatar_from_db(user_id)
    if data is None: return jsonify({"error": "Not found"}), 404
    return jsonify(data)


@app.route("/render/avatar/<int:user_id>")
def render_avatar_for_user(user_id: int):
    """
    Full pipeline: fetch avatar config from DB, render, return URL.
    Equivalent to Roblox's /v1/users/{userId}/avatar-thumbnail-url endpoint.
    """
    thumb_type = request.args.get("type", "full_body")
    size       = int(request.args.get("size", 420))
    data       = fetch_avatar_from_db(user_id)
    if data is None: return jsonify({"error": "Avatar not found"}), 404
    result = _render_avatar_cached(data["body_color"], data["slot_colors"], thumb_type, size, None, 0, 1.0, None, user_id, True)
    result["user_id"] = user_id
    return jsonify(result)


@app.route("/render/avatar/<int:user_id>/headshot")
def render_user_headshot(user_id: int):
    """Shortcut: headshot thumbnail for a user from DB."""
    size = int(request.args.get("size", 420))
    data = fetch_avatar_from_db(user_id)
    if data is None: return jsonify({"error": "Not found"}), 404
    result = _render_avatar_cached(data["body_color"], data["slot_colors"], "headshot", size, None, 0, 1.0, None, user_id, True)
    result["user_id"] = user_id
    return jsonify(result)


@app.route("/render/avatar/<int:user_id>/bust")
def render_user_bust(user_id: int):
    """Shortcut: bust thumbnail for a user from DB."""
    size = int(request.args.get("size", 420))
    data = fetch_avatar_from_db(user_id)
    if data is None: return jsonify({"error": "Not found"}), 404
    result = _render_avatar_cached(data["body_color"], data["slot_colors"], "bust", size, None, 0, 1.0, None, user_id, True)
    result["user_id"] = user_id
    return jsonify(result)


@app.route("/thumbnail/types")
def thumbnail_types():
    """Return supported thumbnail types and sizes — mirrors Roblox API docs."""
    return jsonify({
        "types":       list(CAMERA_PRESETS.keys()),
        "sizes":       sorted(VALID_SIZES),
        "renderer":    "3D" if PYRENDER_OK else "2D_fallback",
        "description": {
            "full_body": "Full character from feet to top of hat",
            "headshot":  "Head and shoulders only (close crop)",
            "bust":      "Waist and up",
        },
        "camera_params": {
            "fov_deg":       "Vertical field of view in degrees (10-70, optional)",
            "y_rot_deg":     "Character Y-axis rotation in degrees (-90 to 90, default 0)",
            "distance_scale":"Camera distance multiplier (0.3-5.0, default 1.0)",
            "bg_color":      "Background hex color or 'transparent'",
        },
    })


# ─────────────────────────────────────────────────────────────────────────────
#  Gunicorn hooks
# ─────────────────────────────────────────────────────────────────────────────

def post_fork(server, worker):
    global _mem_cache, _db_engine, _obj_parser

    _db_engine = None
    _mem_cache = LRUCache(maxsize=CFG["cache_size"])

    if PYRENDER_OK and not os.environ.get("DISPLAY") and "PYOPENGL_PLATFORM" not in os.environ:
        os.environ["PYOPENGL_PLATFORM"] = "osmesa"

    # Re-initialise the OBJ parser in this worker process
    _obj_parser = OBJParser(CFG["obj_path"])
    _obj_parser.parse()   # warm up — parse OBJ on worker start, not on first request

    log.info("Worker PID=%d ready (renderer=%s, parts=%s)",
             os.getpid(), "3D" if PYRENDER_OK else "PIL", list(_obj_parser.parse().keys()))


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point
# ─────────────────────────────────────────────────────────────────────────────

def main():
    global _mem_cache, _obj_parser

    p = argparse.ArgumentParser(description="YourLittleCase! RCCService")
    p.add_argument("--host",       default="127.0.0.1")
    p.add_argument("--port",       type=int, default=2089)
    p.add_argument("--obj",        default=CFG["obj_path"])
    p.add_argument("--output",     default=CFG["output_dir"])
    p.add_argument("--db-url",     default=os.environ.get("RCC_DB_URL",""))
    p.add_argument("--cache-size", type=int, default=512)
    p.add_argument("--debug",      action="store_true")
    args = p.parse_args()

    CFG.update({"obj_path": args.obj, "output_dir": args.output,
                "db_url": args.db_url or None, "cache_size": args.cache_size})

    if PYRENDER_OK and not os.environ.get("DISPLAY") and "PYOPENGL_PLATFORM" not in os.environ:
        os.environ["PYOPENGL_PLATFORM"] = "osmesa"

    _mem_cache  = LRUCache(maxsize=CFG["cache_size"])
    _obj_parser = OBJParser(CFG["obj_path"])
    parts       = _obj_parser.parse()

    log.info("=" * 56)
    log.info("  YourLittleCase! RCCService")
    log.info("  %s:%d", args.host, args.port)
    log.info("  Renderer : %s", "pyrender 3D" if PYRENDER_OK else "PIL 2D fallback")
    log.info("  OBJ parts: %s", list(parts.keys()))
    log.info("  Cache    : %d entries", CFG["cache_size"])
    log.info("  DB       : %s", "configured" if CFG["db_url"] else "none")
    log.info("  Types    : %s", list(CAMERA_PRESETS.keys()))
    log.info("  Sizes    : %s", sorted(VALID_SIZES))
    log.info("=" * 56)

    app.run(host=args.host, port=args.port, debug=args.debug, threaded=False)


if __name__ == "__main__":
    main()
