import json, numpy as np
def load(dirname):
    idx = json.load(open(f"{dirname}/index.json"))["parts"]
    blob = open(f"{dirname}/geometry.bin", "rb").read()
    out = []
    for p in idx:
        pos = np.frombuffer(blob, dtype=np.float32, count=p["posBytes"]//4, offset=p["posOffset"]).reshape(-1, 3).astype(np.float64)
        tri = np.frombuffer(blob, dtype=np.uint32, count=p["idxBytes"]//4, offset=p["idxOffset"]).reshape(-1, 3) if p["idxBytes"] else np.arange(len(pos)).reshape(-1, 3)
        out.append({**p, "pos": pos, "tri": tri.astype(np.int64)})
    return out
