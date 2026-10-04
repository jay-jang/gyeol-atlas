# Female bones (HRA native and male-derived "borrowed") paired with male
# BodyParts3D bones by name. Female lumbar vertebra 6 has no male counterpart.
import json, re
ORD = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"]
inputs = json.load(open("scripts/model-inputs.json"))["assets"]
male_bones = {a["name"].lower(): a["id"] for a in inputs if a["layer"] == "bone"}
FEMUR_PARTS = ("condyle", "Trochlear groove", "Intercondylar fossa", "Distal most point")
def female_to_male(name):
    n = name.strip()
    if any(k in n for k in FEMUR_PARTS): return "left femur" if "left" in n.lower() else "right femur"
    m = re.match(r"(Thoracic|Cervical|Lumbar) vertebra (\d+)$", n)
    if m:
        kind, k = m.group(1).lower(), int(m.group(2))
        if kind == "cervical" and k <= 2: return ["atlas", "axis"][k - 1]
        return None if kind == "lumbar" and k > 5 else f"{ORD[k-1]} {kind} vertebra"
    m = re.match(r"(Femur|Tibia|Fibula|Patella) \((left|right)\)$", n)
    if m: return f"{m.group(2)} {m.group(1).lower()}"
    m = re.match(r"(Ilium|Pubis|Ischium) compact bone \((left|right)\)$", n)
    if m: return f"{m.group(2)} hip bone"
    special = {"Sternum": "body of sternum", "Manubrium": "manubrium", "Sacrum": "sacrum"}
    if n in special: return special[n]
    return n.lower() if n.lower() in male_bones else None
# The borrowed thorax and shoulder girdle were placed by single regional
# similarity transforms upstream (24.5 mm anchor error); they cross the
# native sternum/vertebrae and the skin, so they are not used as guides.
GUIDE_EXCLUDED = re.compile(r"\brib\b|costal cartilage|clavicle|scapula", re.I)
