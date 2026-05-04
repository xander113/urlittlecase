#!/usr/bin/env python3
"""
YourLittleCase! — RCCService  (high-concurrency edition)
=========================================================

Concurrency model
-----------------
pyrender / OpenGL is NOT thread-safe — each OpenGL context belongs to the OS
thread that created it. Sharing one renderer across threads causes crashes.

Strategy:
  • Run under gunicorn with `--worker-class sync --workers N` (multi-process).
    Each OS process gets its own independent OpenGL context and renderer.
  • Within each process, a threading.Lock serialises the single render call so
    that gunicorn's `--threads` option doesn't break OpenGL.
  • An in-process LRU cache (functools.lru_cache via a dict + deque) avoids
    redundant renders for repeated avatar configurations — the most common case
    when many users view the same item or the same avatar.
  • Disk cache: rendered PNGs are written once and served statically by Nginx /
    Laravel; subsequent requests for the same avatar state are served from disk
    without touching the renderer at all.

Gunicorn invocation (production):
  gunicorn main:app \
    --workers 4 \
    --threads 2 \
    --timeout 60 \
    --bind 127.0.0.1:2089 \
    --preload
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
from typing import Optional

import numpy as np
from flask import Flask, jsonify, request
from PIL import Image, ImageDraw

# ── numpy 2.x compat shim (pyrender uses np.infty, removed in numpy 2.0) ─────
for _attr, _val in [('infty', float('inf')), ('bool', bool), ('int', int), ('float', float), ('complex', complex)]:
    if not hasattr(np, _attr):
        setattr(np, _attr, _val)

# ── Optional 3D imports ───────────────────────────────────────────────────────
PYRENDER_AVAILABLE = False
try:
    import trimesh
    import pyrender
    PYRENDER_AVAILABLE = True
except Exception as _e:
    logging.warning("pyrender/trimesh unavailable (%s) — PIL fallback active", _e)

# ── Optional DB ───────────────────────────────────────────────────────────────
SQLALCHEMY_AVAILABLE = False
try:
    from sqlalchemy import create_engine, text
    SQLALCHEMY_AVAILABLE = True
except ImportError:
    pass

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [RCC/%(process)d] %(levelname)s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("rcc")

# ── Flask ─────────────────────────────────────────────────────────────────────
app = Flask(__name__)

CFG: dict = {
    "obj_path":    str(Path(__file__).parent.parent / "public" / "models" / "character_model.obj"),
    "output_dir":  str(Path(__file__).parent.parent / "storage" / "app" / "public"),
    "db_url":      None,
    "canvas_size": 420,
    "cache_size":  256,     # max in-memory cache entries per worker process
}

# ── Per-process render lock (OpenGL is not thread-safe) ───────────────────────
_render_lock = threading.Lock()

# ── OBJ part → clothing slot mapping ─────────────────────────────────────────
PART_SLOTS: dict[str, list[str]] = {
    "head":      ["face"],
    "torso":     ["shirt"],
    "left_arm":  ["shirt"],
    "right_arm": ["shirt"],
    "left_leg":  ["pants"],
    "right_leg": ["pants"],
}

DEFAULT_COLOR = (0xD9, 0xD9, 0xD9)


# ─────────────────────────────────────────────────────────────────────────────
#  LRU in-memory cache (per process, thread-safe)
# ─────────────────────────────────────────────────────────────────────────────

class LRUCache:
    """Thread-safe fixed-size LRU cache backed by an OrderedDict."""

    def __init__(self, maxsize: int = 256):
        self._cache: OrderedDict[str, bytes] = OrderedDict()
        self._maxsize  = maxsize
        self._lock     = threading.Lock()
        self._hits     = 0
        self._misses   = 0

    def get(self, key: str) -> Optional[bytes]:
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None
            self._cache.move_to_end(key)
            self._hits += 1
            return self._cache[key]

    def set(self, key: str, value: bytes) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = value
            if len(self._cache) > self._maxsize:
                self._cache.popitem(last=False)

    def stats(self) -> dict:
        with self._lock:
            return {"hits": self._hits, "misses": self._misses, "size": len(self._cache)}


_mem_cache: Optional[LRUCache] = None


# ─────────────────────────────────────────────────────────────────────────────
#  Colour helpers
# ─────────────────────────────────────────────────────────────────────────────

def hex_to_rgb(hex_str: str) -> tuple[int, int, int]:
    h = (hex_str or "#D9D9D9").lstrip("#")
    if len(h) == 3:
        h = h[0]*2 + h[1]*2 + h[2]*2
    try:
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    except Exception:
        return DEFAULT_COLOR


def hex_to_float(hex_str: str) -> "np.ndarray":
    r, g, b = hex_to_rgb(hex_str)
    return np.array([r/255.0, g/255.0, b/255.0, 1.0], dtype=np.float32)


def part_color(part_name: str, body_color: str, slot_colors: dict) -> str:
    for slot in PART_SLOTS.get(part_name, []):
        d = slot_colors.get(slot)
        if d and d.get("primary"):
            return d["primary"]
    return body_color


# ─────────────────────────────────────────────────────────────────────────────
#  Cache key
# ─────────────────────────────────────────────────────────────────────────────

def _render_key(prefix: str, payload: dict) -> str:
    digest = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()[:24]
    return f"{prefix}_{digest}"


# ─────────────────────────────────────────────────────────────────────────────
#  Disk cache helpers
# ─────────────────────────────────────────────────────────────────────────────

def _thumb_path(filename: str) -> Path:
    p = Path(CFG["output_dir"]) / "thumbnails"
    p.mkdir(parents=True, exist_ok=True)
    return p / filename


def _disk_cached(filename: str) -> Optional[bytes]:
    p = _thumb_path(filename)
    if p.exists():
        try:
            return p.read_bytes()
        except OSError:
            pass
    return None


def _save_png(png_bytes: bytes, filename: str) -> str:
    try:
        _thumb_path(filename).write_bytes(png_bytes)
    except OSError as e:
        log.error("Failed to write thumbnail %s: %s", filename, e)
    return f"/storage/thumbnails/{filename}"


# ─────────────────────────────────────────────────────────────────────────────
#  PIL 2-D fallback renderer
# ─────────────────────────────────────────────────────────────────────────────

class PIL2DRenderer:
    def __init__(self, canvas: int = 420):
        self.sz = canvas

    def render_avatar(self, body_color: str, slot_colors: dict) -> bytes:
        sz   = self.sz
        img  = Image.new("RGBA", (sz, sz), (238, 238, 238, 255))
        draw = ImageDraw.Draw(img)
        bc   = hex_to_rgb(body_color)

        def sc(slot: str) -> tuple[int,int,int]:
            d = slot_colors.get(slot)
            return hex_to_rgb(d["primary"]) if d else bc

        def px(f: float) -> int:
            return int(sz * f)

        shirt_c = sc("shirt")
        pants_c = sc("pants")
        shoe_c  = sc("shoes")
        head_c  = sc("face") if slot_colors.get("face") else bc

        # Shirt (torso + arms)
        draw.rectangle([px(.33), px(.27), px(.67), px(.58)], fill=shirt_c)
        draw.rectangle([px(.18), px(.27), px(.33), px(.56)], fill=shirt_c)
        draw.rectangle([px(.67), px(.27), px(.82), px(.56)], fill=shirt_c)
        # Pants
        draw.rectangle([px(.33), px(.58), px(.49), px(.90)], fill=pants_c)
        draw.rectangle([px(.51), px(.58), px(.67), px(.90)], fill=pants_c)
        # Shoes
        draw.rectangle([px(.31), px(.87), px(.50), px(.94)], fill=shoe_c)
        draw.rectangle([px(.50), px(.87), px(.69), px(.94)], fill=shoe_c)
        # Head
        HR = px(.13)
        HX, HY = sz // 2, px(.13)
        draw.ellipse([HX-HR, HY-HR, HX+HR, HY+HR], fill=head_c)
        draw.rectangle([px(.44), px(.26), px(.56), px(.28)], fill=bc)

        # Hat
        hat = slot_colors.get("hat")
        if hat:
            hc    = hex_to_rgb(hat.get("primary", "#888888"))
            bc2   = hex_to_rgb(hat.get("secondary", hat.get("primary", "#666666")))
            hatW  = int(HR * 1.6)
            hatH  = int(HR * 1.1)
            draw.rectangle([HX-hatW//2, HY-HR-hatH, HX+hatW//2, HY-HR], fill=hc)
            brimW = int(HR * 2.1)
            draw.rectangle([HX-brimW//2, HY-HR-int(hatH*.1), HX+brimW//2, HY-HR+int(hatH*.12)], fill=bc2)

        # Accessory orb
        acc = slot_colors.get("accessory")
        if acc:
            ac = hex_to_rgb(acc.get("primary","#aaaaaa"))
            r  = int(HR * 0.45)
            ax, ay = px(.80), px(.42)
            draw.ellipse([ax-r, ay-r, ax+r, ay+r], fill=ac)

        buf = BytesIO()
        img.save(buf, "PNG", optimize=True)
        return buf.getvalue()

    def render_item(self, color_primary: str, color_secondary: str, category: str) -> bytes:
        sz   = self.sz
        img  = Image.new("RGBA", (sz, sz), (238, 238, 238, 255))
        draw = ImageDraw.Draw(img)
        c1   = hex_to_rgb(color_primary)
        c2   = hex_to_rgb(color_secondary)
        H, Q = sz//2, sz//4

        if category == "hat":
            draw.rectangle([Q, Q, 3*Q, H+Q//3], fill=c1)
            draw.rectangle([Q//2, H-Q//8, 7*Q//2, H+Q//4], fill=c2)
        elif category in ("shirt","gear"):
            draw.rectangle([Q, Q, 3*Q, 3*Q], fill=c1)
            draw.rectangle([Q//2, Q, Q, 3*Q], fill=c2)
            draw.rectangle([3*Q, Q, 7*Q//2, 3*Q], fill=c2)
        elif category == "pants":
            draw.rectangle([Q, Q, H, 3*Q], fill=c1)
            draw.rectangle([H, Q, 3*Q, 3*Q], fill=c1)
            draw.line([H, Q, H, 3*Q], fill=c2, width=max(3, sz//100))
        elif category == "shoes":
            draw.ellipse([Q, H, 3*Q, H+Q], fill=c1)
            draw.rectangle([Q, H, 3*Q, H+Q//2], fill=c2)
        elif category == "face":
            draw.ellipse([Q, Q, 3*Q, 3*Q], fill=c1)
            er = max(5, sz//40)
            ey = H - Q//4
            draw.ellipse([H-Q//2-er, ey-er, H-Q//2+er, ey+er], fill=c2)
            draw.ellipse([H+Q//4-er, ey-er, H+Q//4+er, ey+er], fill=c2)
        elif category == "accessory":
            draw.polygon([H, Q, 3*Q, H, H, 3*Q, Q, H], fill=c1, outline=c2)
        else:
            draw.rectangle([Q, Q, 3*Q, 3*Q], fill=c1)
            draw.rectangle([Q+8, Q+8, 3*Q-8, 3*Q-8], outline=c2, width=max(4, sz//80))

        buf = BytesIO()
        img.save(buf, "PNG", optimize=True)
        return buf.getvalue()


# ─────────────────────────────────────────────────────────────────────────────
#  pyrender 3-D renderer  (thread-guarded via _render_lock)
# ─────────────────────────────────────────────────────────────────────────────

class ThreeDRenderer:
    def __init__(self, obj_path: str, canvas: int = 420):
        self.obj_path  = obj_path
        self.canvas    = canvas
        self._fallback = PIL2DRenderer(canvas)
        self._parts: Optional[dict] = None

    # ── OBJ loader (called once per process, result cached in self._parts) ──

    def _load_parts(self) -> dict:
        if self._parts is not None:
            return self._parts
        if not PYRENDER_AVAILABLE or not os.path.exists(self.obj_path):
            self._parts = {}
            return {}
        try:
            scene = trimesh.load(self.obj_path, process=False, force="scene")
            if isinstance(scene, trimesh.Trimesh):
                parts = {"torso": scene}
            elif isinstance(scene, trimesh.Scene):
                parts = {
                    name.lower().replace(" ","_").replace("-","_"): geom
                    for name, geom in scene.geometry.items()
                    if isinstance(geom, trimesh.Trimesh)
                }
            else:
                parts = {}
            self._parts = parts
            log.info("OBJ loaded: %d parts", len(parts))
        except Exception as exc:
            log.error("OBJ load error: %s", exc)
            self._parts = {}
        return self._parts

    # ── Avatar render ─────────────────────────────────────────────────────────

    def render_avatar(self, body_color: str, slot_colors: dict, user_id: Optional[int] = None) -> bytes:
        if not PYRENDER_AVAILABLE:
            return self._fallback.render_avatar(body_color, slot_colors)
        parts = self._load_parts()
        if not parts:
            return self._fallback.render_avatar(body_color, slot_colors)
        try:
            # Serialise the OpenGL call — one render at a time per process
            with _render_lock:
                return self._render_3d(body_color, slot_colors, parts)
        except Exception as exc:
            log.error("3D render failed: %s", exc)
            return self._fallback.render_avatar(body_color, slot_colors)

    def _render_3d(self, body_color: str, slot_colors: dict, parts: dict) -> bytes:
        canvas = self.canvas

        all_v  = np.vstack([m.vertices for m in parts.values()])
        min_v  = all_v.min(axis=0)
        max_v  = all_v.max(axis=0)
        height = max_v[1] - min_v[1]
        scale  = 1.0 / height if height > 0 else 1.0

        scene = pyrender.Scene(
            bg_color=np.array([0.93, 0.93, 0.93, 1.0]),
            ambient_light=np.array([0.55, 0.55, 0.55, 1.0]),
        )

        # Body parts
        for pname, tmesh in parts.items():
            verts = (tmesh.vertices - min_v) * scale
            m2    = trimesh.Trimesh(vertices=verts, faces=tmesh.faces, process=False)
            m2.fix_normals()
            col   = hex_to_float(part_color(pname, body_color, slot_colors))
            mat   = pyrender.MetallicRoughnessMaterial(
                baseColorFactor=col.tolist(), metallicFactor=0.0, roughnessFactor=0.75)
            scene.add(pyrender.Mesh.from_trimesh(m2, material=mat, smooth=True))

        # Hat
        hat = slot_colors.get("hat")
        if hat and "head" in parts:
            hv = (parts["head"].vertices - min_v) * scale
            hy_max = hv[:,1].max()
            hx_c   = (hv[:,0].min() + hv[:,0].max()) / 2
            hz_c   = (hv[:,2].min() + hv[:,2].max()) / 2
            hw     = (hv[:,0].max() - hv[:,0].min()) * 0.90
            hh     = hw * 0.78
            # Crown: placed exactly at headTop + hh/2
            crown  = trimesh.creation.box(extents=[hw, hh, hw * 0.90])
            crown.apply_translation([hx_c, hy_max + hh/2, hz_c])
            scene.add(pyrender.Mesh.from_trimesh(crown, material=pyrender.MetallicRoughnessMaterial(
                baseColorFactor=hex_to_float(hat.get("primary","#888")).tolist(), metallicFactor=0.0, roughnessFactor=0.6), smooth=False))
            # Brim
            brim = trimesh.creation.box(extents=[hw*1.5, hh*0.10, hw*1.5])
            brim.apply_translation([hx_c, hy_max + hh*0.02, hz_c])
            scene.add(pyrender.Mesh.from_trimesh(brim, material=pyrender.MetallicRoughnessMaterial(
                baseColorFactor=hex_to_float(hat.get("secondary", hat.get("primary","#666"))).tolist(), metallicFactor=0.0, roughnessFactor=0.6), smooth=False))

        # Shoes
        shoe = slot_colors.get("shoes")
        if shoe:
            scol = hex_to_float(shoe.get("primary","#444"))
            for lname in ("left_leg","right_leg"):
                if lname not in parts:
                    continue
                lv  = (parts[lname].vertices - min_v) * scale
                lw  = lv[:,0].max() - lv[:,0].min()
                sh  = trimesh.creation.box(extents=[lw*1.1, lw*0.26, lw*1.45])
                sh.apply_translation([(lv[:,0].min()+lv[:,0].max())/2, lv[:,1].min()+lw*0.13, (lv[:,2].min()+lv[:,2].max())/2+lw*0.15])
                scene.add(pyrender.Mesh.from_trimesh(sh, material=pyrender.MetallicRoughnessMaterial(
                    baseColorFactor=scol.tolist(), metallicFactor=0.0, roughnessFactor=0.5), smooth=False))

        # Camera
        cam      = pyrender.PerspectiveCamera(yfov=np.deg2rad(38), aspectRatio=1.0)
        cam_pose = np.eye(4, dtype=float)
        cam_pose[1, 3] = 0.52
        cam_pose[2, 3] = 2.8
        scene.add(cam, pose=cam_pose)

        # Lights
        key_pose = np.eye(4, dtype=float);  key_pose[:3,3] = [1.0, 2.0, 2.0]
        fil_pose = np.eye(4, dtype=float);  fil_pose[:3,3] = [-1.5, 1.0, -1.0]
        scene.add(pyrender.DirectionalLight(color=np.ones(3), intensity=3.0), pose=key_pose)
        scene.add(pyrender.DirectionalLight(color=np.ones(3), intensity=1.5), pose=fil_pose)

        r = pyrender.OffscreenRenderer(viewport_width=canvas, viewport_height=canvas)
        try:
            color, _ = r.render(scene, flags=pyrender.RenderFlags.RGBA | pyrender.RenderFlags.SHADOWS_DIRECTIONAL)
        finally:
            r.delete()

        buf = BytesIO()
        Image.fromarray(color, "RGBA").save(buf, "PNG", optimize=True)
        return buf.getvalue()

    # ── Item render (PIL only — items don't need 3D) ──────────────────────────

    def render_item(self, color_primary: str, color_secondary: str, category: str) -> bytes:
        return self._fallback.render_item(color_primary, color_secondary, category)


# ─────────────────────────────────────────────────────────────────────────────
#  DB helper
# ─────────────────────────────────────────────────────────────────────────────

_db_engine = None
_db_lock   = threading.Lock()


def _get_engine():
    global _db_engine
    if _db_engine is not None:
        return _db_engine
    with _db_lock:
        if _db_engine is not None:
            return _db_engine
        if not CFG.get("db_url"):
            return None
        try:
            _db_engine = create_engine(
                CFG["db_url"],
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
                pool_timeout=10,
            )
        except Exception as exc:
            log.error("DB engine creation failed: %s", exc)
        return _db_engine


def fetch_avatar_from_db(user_id: int) -> Optional[dict]:
    if not SQLALCHEMY_AVAILABLE:
        return None
    engine = _get_engine()
    if engine is None:
        return None
    try:
        with engine.connect() as conn:
            row = conn.execute(text("""
                SELECT a.body_color,
                       hi.color_primary  AS hat_primary,   hi.color_secondary AS hat_secondary,
                       fi.color_primary  AS face_primary,
                       si.color_primary  AS shirt_primary,
                       pi.color_primary  AS pants_primary,
                       soi.color_primary AS shoes_primary,
                       ai.color_primary  AS acc_primary
                FROM avatars a
                LEFT JOIN user_items uhui ON uhui.id = a.hat_user_item_id
                LEFT JOIN items hi  ON hi.id = uhui.item_id
                LEFT JOIN user_items ufui ON ufui.id = a.face_user_item_id
                LEFT JOIN items fi  ON fi.id = ufui.item_id
                LEFT JOIN user_items usui ON usui.id = a.shirt_user_item_id
                LEFT JOIN items si  ON si.id = usui.item_id
                LEFT JOIN user_items upui ON upui.id = a.pants_user_item_id
                LEFT JOIN items pi  ON pi.id = upui.item_id
                LEFT JOIN user_items usoui ON usoui.id = a.shoes_user_item_id
                LEFT JOIN items soi ON soi.id = usoui.item_id
                LEFT JOIN user_items uaui ON uaui.id = a.accessory_user_item_id
                LEFT JOIN items ai  ON ai.id = uaui.item_id
                WHERE a.user_id = :uid LIMIT 1
            """), {"uid": user_id}).fetchone()

        if not row:
            return None

        def slot(p, s=None):
            return {"primary": p, "secondary": s} if p else None

        return {
            "body_color": row.body_color or "#D9D9D9",
            "slot_colors": {
                "hat":       slot(row.hat_primary,   row.hat_secondary),
                "face":      slot(row.face_primary),
                "shirt":     slot(row.shirt_primary),
                "pants":     slot(row.pants_primary),
                "shoes":     slot(row.shoes_primary),
                "accessory": slot(row.acc_primary),
            },
        }
    except Exception as exc:
        log.error("fetch_avatar_from_db(%d): %s", user_id, exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
#  Request helpers
# ─────────────────────────────────────────────────────────────────────────────

def _slot_colors_from_body(body: dict) -> dict:
    if "slot_colors" in body:
        return body["slot_colors"]
    out = {}
    for slot in ("hat","face","shirt","pants","shoes","accessory"):
        p = body.get(f"{slot}_primary") or body.get(f"{slot}_color")
        if p:
            out[slot] = {"primary": p, "secondary": body.get(f"{slot}_secondary")}
    return out


# ─────────────────────────────────────────────────────────────────────────────
#  Core render function with both cache layers
# ─────────────────────────────────────────────────────────────────────────────

def _render_avatar_cached(
    body_color: str,
    slot_colors: dict,
    user_id: Optional[int],
    do_save: bool,
) -> dict:
    payload  = {"bc": body_color, "sc": slot_colors}
    cache_key = _render_key("avatar", payload)
    filename  = f"{cache_key}.png"

    # 1. Disk cache — fastest, shared across processes
    disk = _disk_cached(filename)
    if disk is not None:
        url = f"/storage/thumbnails/{filename}"
        log.debug("disk cache hit: %s", filename)
        if do_save:
            return {"url": url, "cache": "disk"}
        else:
            return {"base64": base64.b64encode(disk).decode(), "cache": "disk"}

    # 2. In-memory LRU (per process)
    mem = _mem_cache.get(cache_key) if _mem_cache else None
    if mem is not None:
        log.debug("mem cache hit: %s", cache_key)
        if do_save:
            url = _save_png(mem, filename)
            return {"url": url, "cache": "mem"}
        else:
            return {"base64": base64.b64encode(mem).decode(), "cache": "mem"}

    # 3. Render
    t0  = time.time()
    png = _renderer.render_avatar(body_color, slot_colors, user_id)
    elapsed = round(time.time() - t0, 3)
    log.info("rendered avatar user=%s in %.3fs", user_id or "anon", elapsed)

    # Store in both caches
    if _mem_cache:
        _mem_cache.set(cache_key, png)

    if do_save:
        url = _save_png(png, filename)
        return {"url": url, "elapsed": elapsed, "cache": "render"}
    else:
        return {"base64": base64.b64encode(png).decode(), "elapsed": elapsed, "cache": "render"}


def _render_item_cached(
    color_primary: str,
    color_secondary: str,
    category: str,
    item_id: Optional[int],
    do_save: bool,
) -> dict:
    payload   = {"c1": color_primary, "c2": color_secondary, "cat": category}
    cache_key = _render_key("item", payload)
    filename  = f"{cache_key}.png"

    disk = _disk_cached(filename)
    if disk is not None:
        url = f"/storage/thumbnails/{filename}"
        return {"url": url, "cache": "disk"} if do_save else {"base64": base64.b64encode(disk).decode(), "cache": "disk"}

    mem = _mem_cache.get(cache_key) if _mem_cache else None
    if mem is not None:
        url = _save_png(mem, filename) if do_save else None
        return {"url": url or "", "cache": "mem"} if do_save else {"base64": base64.b64encode(mem).decode(), "cache": "mem"}

    png = _renderer.render_item(color_primary, color_secondary, category)

    if _mem_cache:
        _mem_cache.set(cache_key, png)

    if do_save:
        return {"url": _save_png(png, filename), "cache": "render"}
    return {"base64": base64.b64encode(png).decode(), "cache": "render"}


# ─────────────────────────────────────────────────────────────────────────────
#  Flask routes
# ─────────────────────────────────────────────────────────────────────────────

_renderer: Optional[ThreeDRenderer] = None


@app.route("/health")
def health():
    return jsonify({
        "status":    "ok",
        "pid":       os.getpid(),
        "pyrender":  PYRENDER_AVAILABLE,
        "obj":       os.path.exists(CFG["obj_path"]),
        "db":        bool(CFG.get("db_url")),
        "numpy":     np.__version__,
        "cache":     _mem_cache.stats() if _mem_cache else None,
        "ts":        int(time.time()),
    })


@app.route("/render/avatar", methods=["POST"])
def render_avatar():
    body        = request.get_json(force=True, silent=True) or {}
    body_color  = body.get("body_color", "#D9D9D9")
    slot_colors = _slot_colors_from_body(body)
    user_id     = body.get("user_id")
    do_save     = body.get("save", True)

    result = _render_avatar_cached(body_color, slot_colors, user_id, do_save)
    return jsonify(result)


@app.route("/render/item", methods=["POST"])
def render_item():
    body     = request.get_json(force=True, silent=True) or {}
    c1       = body.get("color_primary",   "#6366f1")
    c2       = body.get("color_secondary", "#4338ca")
    cat      = body.get("category", "gear")
    item_id  = body.get("item_id")
    do_save  = body.get("save", True)

    result = _render_item_cached(c1, c2, cat, item_id, do_save)
    return jsonify(result)


@app.route("/fetch/avatar/<int:user_id>")
def fetch_avatar(user_id: int):
    data = fetch_avatar_from_db(user_id)
    if data is None:
        return jsonify({"error": "Not found"}), 404
    return jsonify(data)


@app.route("/render/avatar/<int:user_id>")
def render_avatar_user(user_id: int):
    data = fetch_avatar_from_db(user_id)
    if data is None:
        return jsonify({"error": "Avatar not found"}), 404
    result = _render_avatar_cached(data["body_color"], data["slot_colors"], user_id, do_save=True)
    result["user_id"] = user_id
    return jsonify(result)


@app.route("/cache/clear", methods=["POST"])
def clear_cache():
    """Admin endpoint: clear in-memory LRU cache for a specific key or all."""
    if _mem_cache:
        _mem_cache._cache.clear()
    return jsonify({"ok": True, "pid": os.getpid()})


# ─────────────────────────────────────────────────────────────────────────────
#  Gunicorn hooks
# ─────────────────────────────────────────────────────────────────────────────

def post_fork(server, worker):
    """Called by gunicorn in each worker process after fork."""
    global _renderer, _mem_cache, _db_engine

    # Each worker process gets its own independent state:
    # - its own pyrender OffscreenRenderer context
    # - its own LRU cache (memory is not shared across processes by default)
    # - its own DB connection pool
    _db_engine = None  # reset so each worker creates its own pool
    _mem_cache = LRUCache(maxsize=CFG["cache_size"])
    _renderer  = ThreeDRenderer(obj_path=CFG["obj_path"], canvas=CFG["canvas_size"])

    # Set OSMesa for headless if not already configured
    if PYRENDER_AVAILABLE and not os.environ.get("DISPLAY") and "PYOPENGL_PLATFORM" not in os.environ:
        os.environ["PYOPENGL_PLATFORM"] = "osmesa"

    log.info("Worker PID=%d initialised (pyrender=%s)", os.getpid(), PYRENDER_AVAILABLE)


# ─────────────────────────────────────────────────────────────────────────────
#  Entry point (development only — use gunicorn in production)
# ─────────────────────────────────────────────────────────────────────────────

def main():
    global _renderer, _mem_cache

    p = argparse.ArgumentParser(description="YourLittleCase! RCCService")
    p.add_argument("--host",        default="127.0.0.1")
    p.add_argument("--port",        type=int, default=2089)
    p.add_argument("--obj",         default=CFG["obj_path"])
    p.add_argument("--output",      default=CFG["output_dir"])
    p.add_argument("--db-url",      default=os.environ.get("RCC_DB_URL", ""))
    p.add_argument("--canvas",      type=int, default=420)
    p.add_argument("--cache-size",  type=int, default=256)
    p.add_argument("--debug",       action="store_true")
    args = p.parse_args()

    CFG.update({
        "obj_path":    args.obj,
        "output_dir":  args.output,
        "db_url":      args.db_url or None,
        "canvas_size": args.canvas,
        "cache_size":  args.cache_size,
    })

    if PYRENDER_AVAILABLE and not os.environ.get("DISPLAY") and "PYOPENGL_PLATFORM" not in os.environ:
        os.environ["PYOPENGL_PLATFORM"] = "osmesa"

    _mem_cache = LRUCache(maxsize=CFG["cache_size"])
    _renderer  = ThreeDRenderer(obj_path=CFG["obj_path"], canvas=CFG["canvas_size"])

    log.info("=" * 54)
    log.info("  YourLittleCase! RCCService (dev mode)")
    log.info("  %s:%d", args.host, args.port)
    log.info("  Renderer: %s", "pyrender" if PYRENDER_AVAILABLE else "PIL fallback")
    log.info("  numpy:    %s", np.__version__)
    log.info("  LRU:      %d entries", CFG["cache_size"])
    log.info("  DB:       %s", "configured" if CFG["db_url"] else "none")
    log.info("  WARNING: Use gunicorn in production (see start.sh)")
    log.info("=" * 54)

    app.run(host=args.host, port=args.port, debug=args.debug, threaded=False)


if __name__ == "__main__":
    main()
