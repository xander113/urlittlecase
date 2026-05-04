"""
YourLittleCase! RCCService — gunicorn configuration
"""
import multiprocessing
import os

bind         = f"{os.environ.get('RCC_HOST','127.0.0.1')}:{os.environ.get('RCC_PORT','2089')}"
workers      = multiprocessing.cpu_count() * 2 + 1
worker_class = "sync"
threads      = 1
timeout      = 90          # 3D renders can take ~15s cold; give headroom
graceful_timeout = 45
keepalive    = 5
proc_name    = "ylc-rccservice"
preload_app  = True        # load OBJ once in master, share via copy-on-write
loglevel     = "info"
accesslog    = "-"
errorlog     = "-"
access_log_format = '%(h)s "%(r)s" %(s)s %(b)sB %(D)sµs'

def post_fork(server, worker):
    from main import post_fork as _pf
    _pf(server, worker)

def worker_exit(server, worker):
    import logging
    logging.getLogger("rcc").info("Worker PID=%d exiting", worker.pid)
