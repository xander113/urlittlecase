#!/usr/bin/env bash
# YourLittleCase! RCCService — Start Script
# Dev:  ./rcc_service/start.sh
# Prod: RCC_PROD=1 ./rcc_service/start.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

export PYOPENGL_PLATFORM="${PYOPENGL_PLATFORM:-osmesa}"
export RCC_HOST="${RCC_HOST:-127.0.0.1}"
export RCC_PORT="${RCC_PORT:-2089}"
export RCC_DB_URL="${RCC_DB_URL:-}"
export RCC_PROD="${RCC_PROD:-0}"

OBJ_PATH="${PROJECT_ROOT}/public/models/character_model.obj"
OUTPUT_DIR="${PROJECT_ROOT}/storage/app/public"

if ! command -v python3 &>/dev/null; then echo "[RCC] ERROR: python3 not found." >&2; exit 1; fi

VENV="${SCRIPT_DIR}/.venv"
[ ! -d "$VENV" ] && python3 -m venv "$VENV"
# shellcheck disable=SC1090
source "${VENV}/bin/activate"

if ! python3 -c "import flask" &>/dev/null 2>&1; then
    echo "[RCC] Installing dependencies (two-phase)..."
    pip install --quiet --upgrade pip
    pip install --quiet -r "${SCRIPT_DIR}/requirements.txt"
    pip install --quiet --no-deps pyrender==0.1.45
    pip install --quiet "PyOpenGL==3.1.0" || true
    pip install --quiet "PyOpenGL-accelerate==3.1.0" || true
    echo "[RCC] Install complete."
fi

python3 -c "import pyrender, trimesh" &>/dev/null 2>&1 \
    && echo "[RCC] 3D renderer: pyrender + trimesh (OK)" \
    || echo "[RCC] WARNING: pyrender unavailable — PIL 2D fallback will be used"

echo "[RCC] OBJ: ${OBJ_PATH}"
echo "[RCC] Checking OBJ parts..."
python3 -c "
import sys; sys.path.insert(0, '${SCRIPT_DIR}')
try:
    from main import OBJParser
    p = OBJParser('${OBJ_PATH}')
    parts = p.parse()
    print('[RCC] OBJ parts:', list(parts.keys()))
except Exception as e:
    print('[RCC] OBJ parse check failed:', e)
" 2>/dev/null || true

NCPUS="$(python3 -c 'import multiprocessing; print(multiprocessing.cpu_count())')"
WORKERS=$(( NCPUS * 2 + 1 ))
echo "[RCC] ${RCC_HOST}:${RCC_PORT} | CPUs: ${NCPUS} → ${WORKERS} workers"

if [ "$RCC_PROD" = "1" ]; then
    echo "[RCC] MODE: production (gunicorn)"
    exec gunicorn main:app \
        --config  "${SCRIPT_DIR}/gunicorn.conf.py" \
        --bind    "${RCC_HOST}:${RCC_PORT}" \
        --workers "${WORKERS}" \
        --timeout 90 \
        --chdir   "${SCRIPT_DIR}"
else
    echo "[RCC] MODE: development"
    exec python3 "${SCRIPT_DIR}/main.py" \
        --host   "$RCC_HOST"    \
        --port   "$RCC_PORT"    \
        --obj    "$OBJ_PATH"    \
        --output "$OUTPUT_DIR"  \
        --db-url "$RCC_DB_URL"
fi
