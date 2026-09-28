"""Generate same-donor Visible Human Female CT organ *candidates* offline.

The CT conversion is supported by sampled DICOM headers, not proven for all
slices. MOOSE labels are not anatomical approval or HRA pose registration.
No app models are written by this script.
"""

import argparse
import hashlib
from pathlib import Path

from moosez.moosez import moose


EXPECTED_INPUT_SHA256 = "92996cd3b2e8169d2fcb5456b5a02e06c6269bdeb43b19de8eac1f3421f9edf9"


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output_directory", type=Path)
    parser.add_argument("--accelerator", choices=("cpu", "mps"), default="mps")
    args = parser.parse_args()
    if sha256(args.input) != EXPECTED_INPUT_SHA256:
        raise ValueError("Unexpected candidate HU image SHA-256")
    args.output_directory.mkdir(parents=True, exist_ok=True)
    segmentations, models = moose(
        str(args.input.resolve()), "clin_ct_organs",
        str(args.output_directory.resolve()), args.accelerator,
    )
    for segmentation, model in zip(segmentations, models):
        print({"model": str(model), "output": str(segmentation),
               "sha256": sha256(segmentation),
               "status": "offline female CT candidate only; no HRA registration or anatomical approval"})


if __name__ == "__main__":
    main()
