import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OBJLoader }     from 'three/addons/loaders/OBJLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ─── Constants ─────────────────────────────────────────────────────────────── */

const DEFAULT_HEX = 0xD9D9D9;

const PART_SLOTS = {
    head:      ['face'],
    torso:     ['shirt'],
    left_arm:  ['shirt'],
    right_arm: ['shirt'],
    left_leg:  ['pants'],
    right_leg: ['pants'],
};

/* ─── Helpers ────────────────────────────────────────────────────────────────── */

function hexNum(str) {
    if (!str) return DEFAULT_HEX;
    return parseInt(str.replace('#', ''), 16);
}

/** MeshPhongMaterial — reliable on untextured OBJ without envmap. */
function makeMat(color, shininess = 20) {
    return new THREE.MeshPhongMaterial({
        color,
        shininess,
        specular: new THREE.Color(0x181818),
        flatShading: false,
    });
}

function partColor(partName, bodyColor, slotColors) {
    for (const slot of PART_SLOTS[partName] ?? []) {
        if (slotColors[slot]) return hexNum(slotColors[slot].primary);
    }
    return hexNum(bodyColor);
}

/** World-space bounding box — requires updateMatrixWorld to have been called first. */
function getBounds(mesh) {
    return new THREE.Box3().setFromObject(mesh);
}

/* ─── Make a DirectionalLight with position — correct way ───────────────────── */
/**
 * NEVER use Object.assign to set position on a Three.js object.
 * Object3D.position is declared with Object.defineProperty and has no setter —
 * it is a read-only reference to a Vector3 that must be mutated in-place via
 * .position.set() / .position.copy() / .position.x = … etc.
 * Object.assign tries to overwrite the property itself, throwing TypeError.
 */
function makeLight(color, intensity, x, y, z) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(x, y, z);   // ← mutate in-place, never assign whole Vector3
    return light;
}

/* ─── Clothing extras ────────────────────────────────────────────────────────── */

function buildExtras(scene, meshMap, slotColors, stateRef) {
    // Dispose old
    stateRef.current.extras.forEach(obj => {
        scene.remove(obj);
        obj.traverse(c => {
            c.geometry?.dispose();
            if (c.material) {
                Array.isArray(c.material) ? c.material.forEach(m => m.dispose()) : c.material.dispose();
            }
        });
    });
    stateRef.current.extras = [];

    if (!Object.keys(meshMap).length) return;

    const extras = [];

    /* Hat — crown sits exactly on top of head world-space bounding box */
    if (slotColors.hat && meshMap.head) {
        const b      = getBounds(meshMap.head);
        const headCX = (b.min.x + b.max.x) / 2;
        const headCZ = (b.min.z + b.max.z) / 2;
        const headTop = b.max.y;
        const headW   = b.max.x - b.min.x;
        const headD   = b.max.z - b.min.z;
        const hatH    = headW * 0.80;
        const hatW    = headW * 0.90;
        const hatD    = headD * 0.90;

        const crown = new THREE.Mesh(
            new THREE.BoxGeometry(hatW, hatH, hatD),
            makeMat(hexNum(slotColors.hat.primary), 24)
        );
        crown.position.set(headCX, headTop + hatH / 2, headCZ);
        crown.castShadow = true;
        scene.add(crown);
        extras.push(crown);

        const brim = new THREE.Mesh(
            new THREE.BoxGeometry(hatW * 1.5, hatH * 0.10, hatD * 1.5),
            makeMat(hexNum(slotColors.hat.secondary ?? slotColors.hat.primary), 24)
        );
        brim.position.set(headCX, headTop + hatH * 0.02, headCZ);
        brim.castShadow = true;
        scene.add(brim);
        extras.push(brim);
    }

    /* Shoes */
    if (slotColors.shoes) {
        ['left_leg', 'right_leg'].forEach(name => {
            if (!meshMap[name]) return;
            const b  = getBounds(meshMap[name]);
            const cx = (b.min.x + b.max.x) / 2;
            const cz = (b.min.z + b.max.z) / 2;
            const w  = b.max.x - b.min.x;
            const d  = b.max.z - b.min.z;
            const shH = w * 0.26;
            const shoe = new THREE.Mesh(
                new THREE.BoxGeometry(w * 1.08, shH, d * 1.45),
                makeMat(hexNum(slotColors.shoes.primary), 16)
            );
            shoe.position.set(cx, b.min.y + shH / 2, cz + d * 0.15);
            shoe.castShadow = true;
            scene.add(shoe);
            extras.push(shoe);
        });
    }

    /* Accessory */
    if (slotColors.accessory && meshMap.right_arm) {
        const b   = getBounds(meshMap.right_arm);
        const r   = (b.max.x - b.min.x) * 0.42;
        const gem = new THREE.Mesh(
            new THREE.OctahedronGeometry(r, 0),
            makeMat(hexNum(slotColors.accessory.primary), 55)
        );
        gem.position.set(b.max.x + r, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
        gem.castShadow = true;
        scene.add(gem);
        extras.push(gem);
    }

    stateRef.current.extras = extras;
}

/* ─── Component ──────────────────────────────────────────────────────────────── */

export default function Avatar3DViewer({ bodyColor = '#D9D9D9', slotColors = {}, style, className }) {
    const mountRef = useRef(null);
    const stateRef = useRef({
        renderer: null, scene: null, camera: null,
        controls: null, avatar: null, meshMap: {},
        extras: [], frameId: null, _onResize: null,
    });

    /* ── Build scene ──────────────────────────────────────────────────────── */
    const buildScene = useCallback(() => {
        const mount = mountRef.current;
        if (!mount) return;

        const W = mount.clientWidth  || 340;
        const H = mount.clientHeight || 460;

        const scene    = new THREE.Scene();
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
        renderer.outputColorSpace  = THREE.SRGBColorSpace;
        mount.appendChild(renderer.domElement);

        const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 200);
        camera.position.set(0, 3.5, 12);

        /* ── Lights — use position.set(), never Object.assign ─────────────── */
        scene.add(new THREE.AmbientLight(0xffffff, 1.5));

        // Key light (top-right-front)
        const key = makeLight(0xffffff, 1.2, 4, 10, 6);
        key.castShadow = true;
        key.shadow.camera.near = 0.1;
        key.shadow.camera.far  = 60;
        key.shadow.mapSize.set(1024, 1024);
        scene.add(key);

        // Fill light (left)
        scene.add(makeLight(0xffffff, 0.5, -5, 4, -4));

        // Rim / back light
        scene.add(makeLight(0xffffff, 0.3, 0, -3, -8));

        /* Floor */
        const floor = new THREE.Mesh(
            new THREE.PlaneGeometry(14, 14),
            new THREE.MeshPhongMaterial({ color: 0xd0d0d0, shininess: 0 })
        );
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        scene.add(floor);

        /* Controls */
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, 3, 0);
        controls.enableDamping   = true;
        controls.dampingFactor   = 0.07;
        controls.minDistance     = 4;
        controls.maxDistance     = 20;
        controls.maxPolarAngle   = Math.PI * 0.80;
        controls.minPolarAngle   = 0.15;
        controls.autoRotate      = true;
        controls.autoRotateSpeed = 0.6;
        controls.update();

        stateRef.current = { ...stateRef.current, scene, camera, renderer, controls };

        /* OBJ */
        const loader = new OBJLoader();
        loader.load(
            '/models/character_model.obj',
            (obj) => {
                const rawBox    = new THREE.Box3().setFromObject(obj);
                const rawCenter = rawBox.getCenter(new THREE.Vector3());
                const rawSize   = rawBox.getSize(new THREE.Vector3());
                const scaleFactor = rawSize.y > 0 ? 7 / rawSize.y : 1;

                obj.scale.setScalar(scaleFactor);
                // position.set() — correct mutation of read-only Vector3 reference
                obj.position.set(
                    -rawCenter.x * scaleFactor,
                    -rawBox.min.y * scaleFactor,
                    -rawCenter.z * scaleFactor,
                );

                const meshMap = {};
                obj.traverse(child => {
                    if (!(child instanceof THREE.Mesh)) return;
                    child.geometry?.computeVertexNormals();

                    // Dispose any OBJ-loader-assigned material
                    if (child.material) {
                        Array.isArray(child.material)
                            ? child.material.forEach(m => m.dispose())
                            : child.material.dispose();
                    }

                    const partName   = child.name.toLowerCase();
                    child.material   = makeMat(partColor(partName, bodyColor, slotColors));
                    child.castShadow = true;
                    child.receiveShadow = true;
                    meshMap[partName]   = child;
                });

                stateRef.current.avatar  = obj;
                stateRef.current.meshMap = meshMap;
                scene.add(obj);

                // Force world matrix update before buildExtras computes bounding boxes
                obj.updateMatrixWorld(true);
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

    /* ── Mount / unmount ──────────────────────────────────────────────────── */
    useEffect(() => {
        buildScene();
        return () => {
            const s = stateRef.current;
            if (s.frameId) cancelAnimationFrame(s.frameId);
            window.removeEventListener('resize', s._onResize);
            s.controls?.dispose();
            s.extras.forEach(o => {
                s.scene?.remove(o);
                o.traverse(c => { c.geometry?.dispose(); c.material?.dispose(); });
            });
            if (s.renderer) {
                s.renderer.dispose();
                const canvas = s.renderer.domElement;
                if (canvas.parentNode === mountRef.current) mountRef.current.removeChild(canvas);
            }
        };
    }, []); // eslint-disable-line

    /* ── Reactive: update colors + extras when props change ───────────────── */
    useEffect(() => {
        const { meshMap, scene } = stateRef.current;
        if (!scene || !Object.keys(meshMap).length) return;

        Object.entries(meshMap).forEach(([partName, mesh]) => {
            const col = partColor(partName, bodyColor, slotColors);
            if (mesh.material?.color) mesh.material.color.setHex(col);
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
