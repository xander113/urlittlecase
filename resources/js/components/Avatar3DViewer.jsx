import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader }     from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ─── Constants ──────────────────────────────────────────────────────────── */

const DEFAULT_COLOR = 0xD9D9D9;

/**
 * Maps OBJ object names to clothing slots.
 * A mesh can appear in multiple slots (e.g. shirt covers torso + arms).
 */
const PART_SLOTS = {
    head:      ['face'],
    torso:     ['shirt'],
    left_arm:  ['shirt'],
    right_arm: ['shirt'],
    left_leg:  ['pants'],
    right_leg: ['pants'],
};

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function hex(str) {
    if (!str) return DEFAULT_COLOR;
    return parseInt(str.replace('#', ''), 16);
}

/**
 * MeshPhongMaterial is used instead of MeshStandardMaterial because:
 * 1. It does not require an environment map or high-intensity lighting.
 * 2. OBJ files loaded without MTL will render solid color — no black/wireframe.
 * 3. computeVertexNormals() is called on every geometry to prevent flat shading.
 */
function makeMat(color, shininess = 18) {
    return new THREE.MeshPhongMaterial({
        color,
        shininess,
        specular: new THREE.Color(0x1a1a1a),
        flatShading: false,
    });
}

function getPartColor(partName, bodyColor, slotColors) {
    const slots = PART_SLOTS[partName] ?? [];
    for (const slot of slots) {
        if (slotColors[slot]) return hex(slotColors[slot].primary);
    }
    return hex(bodyColor);
}

/* ─── Attachment point calculator ───────────────────────────────────────────
 * For each body-part mesh, computes the world-space bounding box AFTER the
 * parent group's transform is applied. This gives us exact positions for
 * hat/shoe/accessory placement — mirroring Roblox's attachment system.
 */
function getPartBounds(mesh) {
    const box = new THREE.Box3().setFromObject(mesh);
    return box;
}

/* ─── Clothing extras builder ────────────────────────────────────────────── */

function buildExtras(scene, meshMap, slotColors, stateRef) {
    // Clean up old extras
    stateRef.current.extras.forEach(obj => {
        scene.remove(obj);
        obj.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
        });
    });
    stateRef.current.extras = [];

    const extras = [];

    /* ── Hat ──────────────────────────────────────────────────────────────
     * Placed at the TOP-CENTER of the head mesh bounding box.
     * X and Z are the bounding-box center (not origin) of the head.
     * Y is headBounds.max.y + half hat height → sits perfectly on top.
     */
    if (slotColors.hat && meshMap.head) {
        const headBounds = getPartBounds(meshMap.head);
        const headCX = (headBounds.min.x + headBounds.max.x) / 2;
        const headCZ = (headBounds.min.z + headBounds.max.z) / 2;
        const headTop = headBounds.max.y;
        const headW   = headBounds.max.x - headBounds.min.x;
        const headD   = headBounds.max.z - headBounds.min.z;

        const hatH  = headW * 0.75;
        const hatW  = headW * 0.92;
        const hatD  = headD * 0.92;

        // Crown
        const crown = new THREE.Mesh(
            new THREE.BoxGeometry(hatW, hatH, hatD),
            makeMat(hex(slotColors.hat.primary), 22)
        );
        crown.position.set(headCX, headTop + hatH / 2, headCZ);
        crown.castShadow = true;
        scene.add(crown);
        extras.push(crown);

        // Brim (flat disc wider than crown, sits at crown base)
        const brim = new THREE.Mesh(
            new THREE.BoxGeometry(hatW * 1.45, hatH * 0.12, hatD * 1.45),
            makeMat(hex(slotColors.hat.secondary ?? slotColors.hat.primary), 22)
        );
        brim.position.set(headCX, headTop + hatH * 0.05, headCZ);
        brim.castShadow = true;
        scene.add(brim);
        extras.push(brim);
    }

    /* ── Shoes ─────────────────────────────────────────────────────────── */
    if (slotColors.shoes) {
        const legNames = ['left_leg', 'right_leg'];
        legNames.forEach(name => {
            if (!meshMap[name]) return;
            const b = getPartBounds(meshMap[name]);
            const cx = (b.min.x + b.max.x) / 2;
            const cz = (b.min.z + b.max.z) / 2;
            const w  = b.max.x - b.min.x;
            const d  = b.max.z - b.min.z;
            const shoeH = w * 0.28;

            const shoe = new THREE.Mesh(
                new THREE.BoxGeometry(w * 1.05, shoeH, d * 1.4),
                makeMat(hex(slotColors.shoes.primary), 14)
            );
            shoe.position.set(cx, b.min.y + shoeH / 2, cz + d * 0.18);
            shoe.castShadow = true;
            scene.add(shoe);
            extras.push(shoe);
        });
    }

    /* ── Accessory (shoulder / wrist item) ─────────────────────────────── */
    if (slotColors.accessory && meshMap.right_arm) {
        const b = getPartBounds(meshMap.right_arm);
        const midY = (b.min.y + b.max.y) / 2;
        const r    = (b.max.x - b.min.x) * 0.45;

        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(r, 0),
            makeMat(hex(slotColors.accessory.primary), 60)
        );
        gem.position.set(b.max.x + r * 1.1, midY, (b.min.z + b.max.z) / 2);
        gem.castShadow = true;
        scene.add(gem);
        extras.push(gem);
    }

    stateRef.current.extras = extras;
}

/* ─── Component ──────────────────────────────────────────────────────────── */

export default function Avatar3DViewer({ bodyColor = '#D9D9D9', slotColors = {}, style, className }) {
    const mountRef = useRef(null);
    const stateRef = useRef({
        renderer: null, scene: null, camera: null,
        controls: null, avatar: null, meshMap: {},
        extras: [], frameId: null, _onResize: null,
    });

    /* ── Scene init ───────────────────────────────────────────────────── */
    const buildScene = useCallback(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const W = mount.clientWidth  || 340;
        const H = mount.clientHeight || 460;

        /* Scene */
        const scene = new THREE.Scene();

        /* Use a plain background that respects dark/light — driven by CSS var
           via a transparent renderer + CSS background on the mount div.       */
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);

        /* Camera */
        const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
        camera.position.set(0, 3.5, 12);

        /* Lights — strong ambient prevents the all-black look */
        const ambient = new THREE.AmbientLight(0xffffff, 1.4);
        scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffffff, 1.2);
        key.position.set(4, 10, 6);
        key.castShadow = true;
        key.shadow.camera.near = 0.1;
        key.shadow.camera.far  = 60;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);

        const fill = new THREE.DirectionalLight(0xffffff, 0.55);
        fill.position.set(-5, 4, -4);
        scene.add(fill);

        const rim = new THREE.DirectionalLight(0xffffff, 0.3);
        rim.position.set(0, -3, -8);
        scene.add(rim);

        /* Floor */
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 14),
            new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 0 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        /* Controls */
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 3, 0);
        controls.enableDamping   = true;
        controls.dampingFactor   = 0.07;
        controls.minDistance     = 5;
        controls.maxDistance     = 20;
        controls.maxPolarAngle   = Math.PI * 0.80;
        controls.minPolarAngle   = 0.15;
        controls.autoRotate      = true;
        controls.autoRotateSpeed = 0.6;
        controls.update();

        stateRef.current = { ...stateRef.current, scene, camera, renderer, controls };

        /* Load OBJ */
        const loader = new OBJLoader();
        loader.load(
            '/models/character_model.obj',
            (obj) => {
                /* Compute bounding box to center & scale */
                const box    = new THREE.Box3().setFromObject(obj);
                const center = box.getCenter(new THREE.Vector3());
                const size   = box.getSize(new THREE.Vector3());

                /* Scale to 7 world-units tall */
                const scale = size.y > 0 ? 7 / size.y : 1;
                obj.scale.setScalar(scale);

                /* Center horizontally, set feet at y=0 */
                obj.position.x = -center.x * scale;
                obj.position.y = -box.min.y * scale;
                obj.position.z = -center.z * scale;

                const meshMap = {};

                obj.traverse(child => {
                    if (!(child instanceof THREE.Mesh)) return;

                    /* Compute normals — prevents flat/dark artifacts */
                    if (child.geometry) {
                        child.geometry.computeVertexNormals();
                    }

                    /* Dispose any material the OBJ loader assigned (may be broken) */
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                        else child.material.dispose();
                    }

                    const partName = child.name.toLowerCase();

                    /* Assign fresh Phong material */
                    child.material = makeMat(
                        getPartColor(partName, bodyColor, slotColors)
                    );

                    child.castShadow    = true;
                    child.receiveShadow = true;
                    meshMap[partName]   = child;
                });

                stateRef.current.avatar  = obj;
                stateRef.current.meshMap = meshMap;
                scene.add(obj);

                /* Now that we have meshes with world positions, build extras */
                buildExtras(scene, meshMap, slotColors, stateRef);
            },
            undefined,
            err => console.warn('[Avatar3DViewer] OBJ load error:', err)
        );

        /* Render loop */
        const tick = () => {
            stateRef.current.frameId = requestAnimationFrame(tick);
            stateRef.current.controls?.update();
            renderer.render(scene, camera);
        };
        tick();

        /* Resize */
        const onResize = () => {
            if (!mountRef.current) return;
            const w = mountRef.current.clientWidth  || 340;
            const h = mountRef.current.clientHeight || 460;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        };
        window.addEventListener('resize', onResize);
        stateRef.current._onResize = onResize;
    }, []); // eslint-disable-line

    /* ── Mount / unmount ──────────────────────────────────────────────── */
    useEffect(() => {
        buildScene();
        return () => {
            const s = stateRef.current;
            if (s.frameId) cancelAnimationFrame(s.frameId);
            window.removeEventListener('resize', s._onResize);
            s.controls?.dispose();
            s.extras.forEach(obj => {
                s.scene?.remove(obj);
                obj.traverse(c => { c.geometry?.dispose(); c.material?.dispose(); });
            });
            if (s.renderer) {
                s.renderer.dispose();
                const canvas = s.renderer.domElement;
                if (canvas.parentNode === mountRef.current) mountRef.current.removeChild(canvas);
            }
        };
    }, []); // eslint-disable-line

    /* ── React to prop changes ────────────────────────────────────────── */
    useEffect(() => {
        const { meshMap, scene } = stateRef.current;
        if (!scene || Object.keys(meshMap).length === 0) return;

        Object.entries(meshMap).forEach(([partName, mesh]) => {
            const col = getPartColor(partName, bodyColor, slotColors);
            if (mesh.material?.color) {
                mesh.material.color.setHex(col);
            }
        });

        buildExtras(scene, meshMap, slotColors, stateRef);
    }, [bodyColor, slotColors]); // eslint-disable-line

    return (
        <div
            ref={mountRef}
            className={className ?? ''}
            style={{
                borderRadius: 'var(--r-lg)',
                overflow: 'hidden',
                background: 'var(--bg-3)',
                cursor: 'grab',
                userSelect: 'none',
                ...style,
            }}
        />
    );
}
