"""Offline MOOSE bone candidate for the BoneHub Visible Human Female CT.

Results stay in .cache. A segmentation is not imported into the atlas until
the original same-donor bone labels and surrounding tissues are audited.
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
        str(args.input.resolve()),
        "clin_ct_peripheral_bones",
        str(args.output_directory.resolve()),
        args.accelerator,
    )
    for segmentation, model in zip(segmentations, models):
        print({
            "model": str(model),
            "output": str(segmentation),
            "sha256": sha256(segmentation),
            "status": "offline candidate only; same-donor label agreement unverified",
        })


if __name__ == "__main__":
    main()
