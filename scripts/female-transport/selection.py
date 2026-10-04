# Which male structures are carried into the female body, and why the rest are not.
import json, re
MALE_ONLY = re.compile(r'penis|penile|scrot|testic|testis|sperm|prostat|cremaster|seminal|deferen|epididym|bulbourethral|glans', re.I)
# Structures the female sources already model (HRA v1.10): kept from the female source.
# The HRA left common carotid, left subclavian and left pulmonary arteries are
# short partial segments; the whole male vessels are carried so their branches
# connect, and the partial female segments wait for search (src/female-transport.ts).
FEMALE_VESSELS = re.compile(r'^(Abdominal aorta|Ascending aorta|Thoracic aorta|Aortic arch|Brachiocephalic trunk|'
    r'Pulmonary trunk|Bifurcation of pulmonary trunk|Right pulmonary artery|(Right|Left) (superior|inferior) pulmonary vein|Superior vena cava|Inferior vena cava.*|'
    r'Coeliac trunk|(Superior|Inferior) mesenteric (artery|vein)|(Right|Middle|Left) colic (artery|vein)|(Ascending|Descending) branch of left colic artery|Ileocolic (artery|vein)|'
    r'(Colic|Ileal) branch of ileocolic artery|Sigmoid (arteries|veins)|Superior anorectal (artery|vein)|Marginal artery|Splenic (artery|vein)|(Common|Proper) hepatic artery|Hepatic veins|'
    r'Hepatic portal vein|(Right|Left) renal (artery|vein)|(Anterior|Posterior) branch of renal artery.*|Intrarenal (arteries|veins) of .*|Common iliac vein.*|Internal iliac vein.*|'
    r'Internal pudendal vein.*|Ophthalmic artery.*|(Superior|Inferior) ophthalmic vein.*|Central retinal (artery|vein).*|(Short|Long) posterior ciliary arteries.*)$')
FEMALE_KNEE = re.compile(r'cruciate ligament|tibial collateral ligament|fibular collateral ligament|^(Lateral |Medial )?[Mm]eniscus|Patellar ligament|quadriceps', re.I)
# Branches that follow the male external genitalia (scrotum, penis) out of the body.
MALE_GENITAL_BRANCH = re.compile(r'^(Superficial external pudendal artery|Deep external pudendal artery|External pudendal veins|Genital branch of genitofemoral nerve)', re.I)
LACRIMAL = re.compile(r'lacrimal|Nasolacrimal', re.I)
def nerve_rule(s):
    h = s.get('hierarchy') or []
    if h[:1] == ['중추신경계']: return None if s['name'] == 'Cauda equina' else 'female brain/spinal cord sources'
    if h[:1] == ['감각기관'] and len(h) > 1 and h[1] in ('Eyeball', '눈') and not LACRIMAL.search(s['name']): return 'female eye source'
    if re.match(r'Optic (nerve|chiasm|tract)', s['name']): return 'female optic nerve source'
    if MALE_GENITAL_BRANCH.match(s['name']): return 'male external genital course'
    return None
def vessel_rule(s):
    if MALE_ONLY.search(s['name']): return 'male-only'
    if MALE_GENITAL_BRANCH.match(s['name']): return 'male external genital course'
    h = s.get('hierarchy') or []
    if h[:1] in (['심장'], ['심장혈관']): return 'female heart source'
    if FEMALE_VESSELS.match(s['name']): return 'female vessel source'
    return None
def muscle_rule(a):
    if MALE_ONLY.search(a['name']): return 'male-only'
    if re.match(r'(right|left) rectus femoris$', a['name']): return 'female knee source'
    return None
def connective_rule(s):
    if MALE_ONLY.search(s['name']): return 'male-only'
    if FEMALE_KNEE.search(s['name']): return 'female knee source'
    return None
LYMPH_DUP = re.compile(r'^(Spleen|(Right|Left) lobe of thymus|Palatine tonsil.*)$')
def lymph_rule(s): return 'female spleen/thymus/tonsil source' if LYMPH_DUP.match(s['name']) else None
# Organs the female whole body lacks (her stomach, oesophagus and adrenals are
# only in the separate CT detail); carried like the other male structures.
ORGANS_MISSING = {'FMA7131', 'FMA7148', 'FMA15629', 'FMA15630', 'FJ3670', 'FJ3671', 'FJ3672', 'FJ3673', 'FJ3674', 'FJ3675', 'FJ3676', 'FMA13889'}
BONE_MISSING = re.compile(r'^(xiphoid process|(right|left) lacrimal bone|(right|left) inferior nasal concha|sesamoid bone of (right|left) foot|interosseous membrane of (right|left) (forearm|leg)|(right|left) long plantar ligament|(right|left) costal cartilage)$')
def selection():
    fss = json.load(open('data/full-system-structures.json')); cs = json.load(open('data/connective-structures.json'))
    inputs = json.load(open('scripts/model-inputs.json'))['assets']; lymph = [s for s in json.load(open('data/sex-lymph-structures.json')) if s['sex'] == 'male']
    out, skipped = [], []
    def take(src, s, layer, reason):
        (skipped if reason else out).append({'source': src, 'id': s['id'], 'name': s['name'], 'layer': layer, **({'reason': reason} if reason else {})})
    for s in fss: take(f"{s['layer']}-full.glb", s, s['layer'], nerve_rule(s) if s['layer'] == 'nerve' else vessel_rule(s))
    for s in cs: take(s['model'], s, s['layer'], connective_rule(s))
    for a in inputs:
        if a['layer'] == 'muscle': take('muscle.glb', a, 'muscle', muscle_rule(a))
        elif a['layer'] == 'bone' and BONE_MISSING.match(a['name']): take('bone.glb', a, 'bone', None)
        elif a['layer'] == 'organ' and a['id'] in ORGANS_MISSING: take('organ.glb', a, 'organ', None)
    for s in lymph: take('reference/lymphatic_male.glb', s, 'lymph', lymph_rule(s))
    return out, skipped
if __name__ == '__main__':
    import collections
    out, skipped = selection()
    print(collections.Counter((o['source']) for o in out))
    print(collections.Counter((o['source'], o['reason']) for o in skipped))
