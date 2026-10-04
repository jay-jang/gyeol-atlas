# Articulated segments of the male skeleton (BodyParts3D names).
import re
FINGERS = ['thumb', 'index finger', 'middle finger', 'ring finger', 'little finger']
def segment_of(name):
    n = name.lower()
    side = 'left' if re.search(r'\bleft\b', n) else 'right' if re.search(r'\bright\b', n) else ''
    if re.search(r'(occipital|frontal|parietal|temporal|sphenoid|ethmoid|zygomatic|nasal bone|maxilla|palatine|lacrimal|vomer|inferior nasal concha|mandible|hyoid|tooth|gingiva)', n) or n in ('atlas', 'axis', 'intervertebral disk of axis'):
        return 'head'
    if re.search(r'(clavicle|scapula)', n): return f'girdle-{side}'
    if 'humerus' in n: return f'upperarm-{side}'
    if re.search(r'(radius|ulna|interosseous membrane of (left|right) forearm)', n): return f'forearm-{side}'
    for f in FINGERS:
        if 'phalanx' in n and f in n: return f'finger{FINGERS.index(f)+1}-{side}'
    if re.search(r'(metacarpal|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate)', n): return f'hand-{side}'
    if 'femur' in n: return f'thigh-{side}'
    if re.search(r'(tibia|fibula|patella|interosseous membrane of (left|right) leg)', n): return f'leg-{side}'
    if re.search(r'(toe)', n): return f'toes-{side}'
    if re.search(r'(talus|calcaneus|navicular|cuboid|cuneiform|metatarsal|sesamoid|plantar)', n): return f'foot-{side}'
    return 'torso'
