"""Independent nibabel header/affine readback; not a tissue segmentation audit."""
import hashlib
import json
from pathlib import Path
import nibabel as nib
import numpy as np

root = Path('.cache/bonehub/ac8de2b38f5ae1a0996053ca0639dd6ae43358f1')
receipt_path = root / 'ct-receipt.json'
receipt = json.loads(receipt_path.read_text())
image = nib.load(receipt['sourceFile']['file'])
n = receipt['nifti']
assert list(image.shape) == n['dims'][1:4]
assert image.get_data_dtype() == np.dtype('uint16')
assert image.header.get_xyzt_units()[0] == 'mm'
assert image.dataobj.slope == 1 and image.dataobj.inter == 0
sform, scode = image.get_sform(coded=True)
qform, qcode = image.get_qform(coded=True)
np.testing.assert_array_equal(sform[:3], np.array(n['sformRas']))
np.testing.assert_allclose(qform, sform, atol=1e-12, rtol=0)
assert int(scode) == n['sformCode'] and int(qcode) == n['qformCode']
report = {
    'status': 'Independent NIfTI affine/header readback; not HU or tissue validation',
    'reader': f'nibabel {nib.__version__}',
    'shape': list(image.shape), 'dtype': str(image.get_data_dtype()),
    'units': list(image.header.get_xyzt_units()),
    'sform': sform.tolist(), 'qform': qform.tolist(),
    'maximumQformSformDifference': float(np.max(np.abs(qform-sform))),
    'slope': image.dataobj.slope, 'intercept': image.dataobj.inter,
    'files': [{'file': str(p), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
              for p in [receipt_path, Path(__file__)]],
}
(root / 'ct-readback.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
