# Export the grand-mean curves (100 points, 0–100 % inclusive) of the normal stair
# height (0.17 m) from the Darmstadt stair dataset's Data_fully_processed.mat
# (doi:10.48328/tudatalib-1182, v1.0) to JSON for scripts/stairs/build-stairs.mjs.
# Angles in degrees with the page's signs: thigh = −Athi (forward +), knee = −Akne
# (flexion +), ankle = Aank (dorsiflexion +), hipPelvis = Ahip.
#   python3 -I scripts/stairs/export-darmstadt.py Data_fully_processed.mat dd-normal.json   (needs scipy, numpy)
import sys, json
import scipy.io as sio
import numpy as np
fp = sio.loadmat(sys.argv[1], squeeze_me=True, struct_as_record=False)['data']
R = 180 / np.pi
out = {'info': str(fp.info)[:4000] if not hasattr(fp.info, '_fieldnames') else {k: str(getattr(fp.info, k))[:3000] for k in fp.info._fieldnames}}
angles = {'thigh': ('Athi', -R), 'knee': ('Akne', -R), 'ankle': ('Aank', R), 'hipPelvis': ('Ahip', R), 'shank': ('Asha', R)}
curves = ['Phip', 'Pkne', 'Pank', 'Mhip', 'Mkne', 'Mank', 'CoM_y', 'CoM_x', 'CoM_Vy', 'CoM_Vx', 'BF', 'RF', 'VL', 'GAS', 'SOL', 'TA']
scalars = ['Duration_stance', 'Duration_stride', 'Whip_p', 'Whip_n', 'Wkne_p', 'Wkne_n', 'Wank_p', 'Wank_n', 'Whip_t', 'Wkne_t', 'Wank_t']
for mode in ['ascent', 'descent']:
    for k in range(1, 12):
        st = getattr(getattr(fp.normal, mode), f'stride{k}')
        d = {}
        for name, (f, s) in angles.items():
            v = getattr(st, f)
            d[name] = {'mean': (v.grand_mean * s).round(3).tolist(), 'sd': (v.grand_std * abs(s)).round(3).tolist()}
        for f in curves:
            v = getattr(st, f)
            d[f] = {'mean': np.asarray(v.grand_mean, float).round(5).tolist(), 'sd': np.asarray(v.grand_std, float).round(5).tolist()}
        for f in scalars:
            v = getattr(st, f)
            d[f] = {'mean': float(v.grand_mean), 'sd': float(v.grand_std), 'subj': np.asarray(v.subj_mean, float).round(5).tolist()}
        out[f'{mode[0].upper()}{k}'] = d
json.dump(out, open(sys.argv[2], 'w'))
print('ok', list(out.keys()))
