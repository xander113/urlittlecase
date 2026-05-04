#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# YourLittleCase! RCCService — Start Script
#
# Dev mode:    ./rcc_service/start.sh
# Prod mode:   RCC_PROD=1 ./rcc_service/start.sh
# With DB:     RCC_DB_URL="postgresql+psycopg2://u:p@127.0.0.1/db" ./rcc_service/start.sh
# ─────────────────────────────────────────────────────────────────────────────

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

# ── Python check ──────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "[RCCService] ERROR: python3 not found." >&2; exit 1
fi

# ── Virtualenv ────────────────────────────────────────────────────────────────
VENV="${SCRIPT_DIR}/.venv"
[ ! -d "$VENV" ] && python3 -m venv "$VENV" && echo "[RCCService] Created venv."
# shellcheck disable=SC1090
source "${VENV}/bin/activate"

# ── Two-phase install ─────────────────────────────────────────────────────────
# Phase 1: everything except pyrender and PyOpenGL
if ! python3 -c "import flask" &>/dev/null 2>&1; then
    echo "[RCCService] Installing dependencies..."
    pip install --quiet --upgrade pip

    # Phase 1 — base packages (no pyopengl, no pyrender)
    pip install --quiet \
        "flask>=3.0.0,<4.0" \
        "Pillow>=10.0.0" \
        "numpy>=1.24.0,<2.0.0" \
        "trimesh>=4.0.0" \
        "sqlalchemy>=2.0.0" \
        "pymysql>=1.1.0" \
        "psycopg2-binary>=2.9.0" \
        "gunicorn>=21.0.0"

    # Phase 2 — pyrender without its conflicting PyOpenGL pin, then add PyOpenGL explicitly
    echo "[RCCService] Installing pyrender (no-deps) + PyOpenGL==3.1.0..."
    pip install --quiet --no-deps pyrender==0.1.45
    pip install --quiet "PyOpenGL==3.1.0" || true
    pip install --quiet "PyOpenGL-accelerate==3.1.0" || true  # optional C accelerator

    echo "[RCCService] Install complete."
fi

# ── Verify renderer ───────────────────────────────────────────────────────────
if python3 -c "import pyrender, trimesh" &>/dev/null 2>&1; then
    echo "[RCCService] 3D renderer: pyrender + trimesh (OK)"
else
    echo "[RCCService] 3D renderer: PIL fallback (pyrender unavailable — thumbnails will be 2D)"
fi

NCPUS="$(python3 -c 'import multiprocessing; print(multiprocessing.cpu_count())')"
WORKERS=$(( NCPUS * 2 + 1 ))

echo "[RCCService] Host:    ${RCC_HOST}:${RCC_PORT}"
echo "[RCCService] OBJ:     ${OBJ_PATH}"
echo "[RCCService] Output:  ${OUTPUT_DIR}"
echo "[RCCService] DB:      ${RCC_DB_URL:-none}"
echo "[RCCService] CPUs:    ${NCPUS} → ${WORKERS} workers"

# ── Launch ────────────────────────────────────────────────────────────────────
if [ "$RCC_PROD" = "1" ]; then
    echo "[RCCService] MODE: production (gunicorn, ${WORKERS} workers)"
    exec gunicorn main:app \
        --config  "${SCRIPT_DIR}/gunicorn.conf.py" \
        --bind    "${RCC_HOST}:${RCC_PORT}" \
        --workers "${WORKERS}" \
        --timeout 60 \
        --chdir   "${SCRIPT_DIR}"
else
    echo "[RCCService] MODE: development (single process Flask)"
    exec python3 "${SCRIPT_DIR}/main.py" \
        --host   "$RCC_HOST"    \
        --port   "$RCC_PORT"    \
        --obj    "$OBJ_PATH"    \
        --output "$OUTPUT_DIR"  \
        --db-url "$RCC_DB_URL"
fi
