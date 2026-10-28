# ctypes wrapper of scripts/modesty/rt.c (BVH first-hit ray casting), compiled
# on first use to .cache/modesty/rt.dylib. Used by gen.py and check.py.
import ctypes, os, subprocess
import numpy as np

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rt.c')
LIB = os.path.join('.cache', 'modesty', 'rt.dylib')
_lib = None


def lib():
    global _lib
    if _lib is None:
        if not os.path.exists(LIB) or os.path.getmtime(LIB) < os.path.getmtime(SRC):
            os.makedirs(os.path.dirname(LIB), exist_ok=True)
            subprocess.check_call(['cc', '-O2', '-shared', '-fPIC', '-o', LIB, SRC])
        _lib = ctypes.CDLL(os.path.abspath(LIB))
        _lib.bvh_build.restype = ctypes.c_void_p
        _lib.bvh_build.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int]
        _lib.bvh_free.argtypes = [ctypes.c_void_p]
        _lib.bvh_cast.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_int, ctypes.c_double, ctypes.c_int,
                                  ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p]
    return _lib


def _p(a):
    return a.ctypes.data_as(ctypes.c_void_p)


class Mesh:
    def __init__(self, V, T):
        self.V = np.ascontiguousarray(V, np.float64)
        self.T = np.ascontiguousarray(T, np.int32)
        self.h = lib().bvh_build(_p(self.V), _p(self.T), len(self.T))

    def __del__(self):
        try: lib().bvh_free(self.h)
        except Exception: pass

    def cast(self, O, D, tmax=1e9, cull=0):
        """First hit along each ray: (triangle or -1, t, u, v, seen from the front). cull=1 ignores back faces."""
        D = np.ascontiguousarray(D, np.float64)
        O = np.ascontiguousarray(np.broadcast_to(O, D.shape), np.float64)
        n = len(D)
        tri = np.empty(n, np.int32); t = np.empty(n); u = np.empty(n); v = np.empty(n); fr = np.empty(n, np.int32)
        lib().bvh_cast(self.h, _p(O), _p(D), n, tmax, cull, _p(tri), _p(t), _p(u), _p(v), _p(fr))
        return tri, t, u, v, fr.astype(bool)
