"""
YourLittleCase! RCCService — gunicorn configuration
=====================================================

gunicorn invocation (handled automatically by start.sh):
  gunicorn --config rcc_service/gunicorn.conf.py main:app

Worker model rationale
----------------------
pyrender / OpenGL contexts are per-OS-thread. Using threaded workers with a
shared renderer would corrupt the OpenGL state. Therefore:

  worker_class = "sync"   — one request per worker at a time
  workers      = CPU*2+1  — multiple processes, each with its own GL context
  threads      = 1        — no threading within a worker (safe for OpenGL)
  timeout      = 60       — render can take up to ~10s; give headroom

The post_fork hook in main.py initialises a fresh renderer + LRU cache in
every worker after the OS fork, so state is never shared.

Throughput
----------
With 4 CPU cores → 9 workers → up to 9 concurrent renders.
The disk + in-memory LRU caches mean repeated renders (same avatar config)
are served without touching the renderer at all, so effective throughput
is much higher for real-world usage patterns.
"""

import multiprocessing
import os

# ── Bind ──────────────────────────────────────────────────────────────────────
bind    = f"{os.environ.get('RCC_HOST','127.0.0.1')}:{os.environ.get('RCC_PORT','2089')}"

# ── Workers ───────────────────────────────────────────────────────────────────
workers      = multiprocessing.cpu_count() * 2 + 1   # e.g. 4 cores → 9
worker_class = "sync"       # sync workers — required for OpenGL thread safety
threads      = 1            # no threads per worker (OpenGL is not thread-safe)
worker_connections = 1      # irrelevant for sync workers, but set explicitly

# ── Timeouts ──────────────────────────────────────────────────────────────────
timeout       = 60    # worker is killed if silent for this many seconds
graceful_timeout = 30 # time to finish in-flight requests on SIGTERM
keepalive     = 5

# ── Process title ─────────────────────────────────────────────────────────────
proc_name = "ylc-rccservice"

# ── Preload ───────────────────────────────────────────────────────────────────
# Preload the app in the master before forking.
# - Saves memory (shared code pages via copy-on-write)
# - OBJ file is loaded once in the master, then available read-only in workers
# WARNING: post_fork() in main.py resets mutable state (renderer, cache, DB pool)
#          so each worker still gets its own isolated GL context.
preload_app = True

# ── Logging ───────────────────────────────────────────────────────────────────
loglevel     = "info"
accesslog    = "-"    # stdout
errorlog     = "-"    # stdout
access_log_format = '%(h)s "%(r)s" %(s)s %(b)sB %(D)sµs'

# ── Hooks ─────────────────────────────────────────────────────────────────────
def post_fork(server, worker):
    """Delegate to the hook defined in main.py."""
    from main import post_fork as _pf, CFG
    _pf(server, worker)


def worker_exit(server, worker):
    import logging
    logging.getLogger("rcc").info("Worker PID=%d exiting", worker.pid)
