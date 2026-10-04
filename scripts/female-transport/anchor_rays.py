# Acupoint anchors through the registration field: each male anchor's skin
# point and outward direction (data/anchors.json) carried into the female body.
# Writes .cache/female-transport/out/anchor-rays.bin for
# scripts/build-female-anchors.mjs. Separate from warp.py so a change to the
# male anchors does not re-carry every structure.
#
# Usage: .cache/female-ct-venv/bin/python scripts/female-transport/anchor_rays.py
import sys, os, json, numpy as np
sys.path.insert(0, 'scripts/female-transport')
from scene import load
from field import Field
CACHE = '.cache/female-transport'; OUT = f'{CACHE}/out'; os.makedirs(OUT, exist_ok=True)
W = Field(male=load(f'{CACHE}/male-scene'))
anchors = json.load(open('data/anchors.json'))
S = np.array([x['surfacePoint'] for x in anchors]); Pm = np.array([x['position'] for x in anchors]); nrm = (Pm - S) / np.linalg.norm(Pm - S, axis=1)[:, None]
q = W(S); qn = W(S + 0.01 * nrm) - q; qn /= np.linalg.norm(qn, axis=1)[:, None]
open(f'{OUT}/anchor-rays.bin', 'wb').write(np.hstack([q, qn]).astype(np.float32).tobytes())
print('anchor rays', len(anchors))
