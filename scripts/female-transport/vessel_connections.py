# Carried male vessels that open into a vessel the female HRA source models:
# a branch of that artery or a tributary of that vein (TA2 / FMA "branch of",
# "tributary of"), or the confluence of two veins. Editorial classification of
# the pairs that touch (< 1 mm) in the male source; every other touching pair
# is a contact (an artery lying on a vein, crossing vessels) and is not
# joined. Keys are (carried Z-Anatomy name, female HRA name as in
# vessel_pairs.PAIRS joined with "/").
import re
VEIN = re.compile(r'\bveins?\b|vena|venous|sinus|plexus|azygos', re.I)
def vessel_kind(name):
    """'vein' or 'artery' for a carried Z-Anatomy vessel (venous arches are veins; arterial anastomoses arteries)."""
    return 'vein' if VEIN.search(name) else 'artery'
AORTA = 'Descending aorta a/Descending aorta b'
# Other female vessels a connection may meet instead (anatomical variants).
ALTERNATIVES = {
    ('Iliolumbar vein (right)', 'Internal iliac vein (right)'): ['Right common iliac vein'],
    ('Iliolumbar vein (left)', 'Internal iliac vein (left)'): ['Left common iliac vein'],
}
CONNECTIONS = {
    # Branches of the aorta and its arch
    ('Left subclavian artery', 'Aortic arch'): 'branch',
    ('Right common carotid artery', 'Brachiocephalic artery a/Brachiocephalic artery b'): 'branch',
    ('Right subclavian artery', 'Brachiocephalic artery a/Brachiocephalic artery b'): 'branch',
    ('Posterior intercostal arteries (right)', AORTA): 'branch',
    ('Posterior intercostal arteries (left)', AORTA): 'branch',
    ('Subcostal artery (right)', AORTA): 'branch',
    ('Inferior phrenic artery', AORTA): 'branch',
    ('Lumbar arteries (right)', AORTA): 'branch',
    ('Lumbar arteries (left)', AORTA): 'branch',
    ('Common iliac artery (right)', AORTA): 'branch',
    ('Common iliac artery (left)', AORTA): 'branch',
    # Visceral arteries
    ('Left gastric artery', 'Celiac trunk'): 'branch',
    ('Gastroduodenal artery', 'Common hepatic artery'): 'branch',
    ('Gastroduodenal artery', 'Proper hepatic artery'): 'branch',  # at the division of the common hepatic artery
    ('Inferior pancreaticoduodenal artery', 'Superior mesenteric artery'): 'branch',
    ('Inferior suprarenal artery (right)', 'Right renal artery'): 'branch',
    ('Inferior suprarenal artery (left)', 'Left renal artery'): 'branch',
    # Pulmonary arteries
    ('Left pulmonary artery', 'Pulmonary trunk'): 'branch',
    ('Superior lobar artery of right lung', 'Pulmonary artery (right)'): 'branch',
    ('Posterior segmental artery of right lung', 'Pulmonary artery (right)'): 'branch',
    ('Middle lobar artery of right lung', 'Pulmonary artery (right)'): 'branch',
    # Veins
    ('Azygos vein', 'Superior vena cava'): 'tributary',
    ('Right brachiocephalic vein', 'Superior vena cava'): 'confluence',
    ('Right gastro-omental vein', 'Superior mesenteric vein'): 'tributary',
    ('Left gastro-omental vein', 'Splenic vein'): 'tributary',
    ('Right ascending lumbar vein', 'Right common iliac vein'): 'tributary',
    # The external iliac vein continues into the common iliac vein, which the
    # female source models; its touch on the internal iliac vein at the male
    # confluence is a contact.
    ('External iliac vein (left)', 'Left common iliac vein'): 'continuation',
    # The iliolumbar vein ends in the internal or the common iliac vein (a
    # common variant); either female vessel completes it.
    ('Iliolumbar vein (right)', 'Internal iliac vein (right)'): 'tributary',
    ('Iliolumbar vein (left)', 'Internal iliac vein (left)'): 'tributary',
    ('Superior gluteal veins (right)', 'Internal iliac vein (right)'): 'tributary',
    ('Superior gluteal veins (left)', 'Internal iliac vein (left)'): 'tributary',
    ('Inferior gluteal veins (right)', 'Internal iliac vein (right)'): 'tributary',
    ('Inferior gluteal veins (left)', 'Internal iliac vein (left)'): 'tributary',
    # Pulmonary veins (segmental veins of each lobe)
    ('Apical vein of right lung', 'Pulmonary vein superior (right)'): 'tributary',
    ('Anterior vein of right lung', 'Pulmonary vein superior (right)'): 'tributary',
    ('Posterior vein of right lung', 'Pulmonary vein superior (right)'): 'tributary',
    ('Lateral vein of right lung', 'Pulmonary vein superior (right)'): 'tributary',
    ('Medial vein of right lung', 'Pulmonary vein superior (right)'): 'tributary',
    ('Superior vein of right lung', 'Pulmonary vein inferior (right)'): 'tributary',
    ('Superior basal vein of right lung', 'Pulmonary vein inferior (right)'): 'tributary',
    ('Inferior basal vein of right lung', 'Pulmonary vein inferior (right)'): 'tributary',
    ('Apicoposterior vein of left lung', 'Pulmonary vein superior (left)'): 'tributary',
    ('Anterior vein of left lung', 'Pulmonary vein superior (left)'): 'tributary',
    ('Lingular vein of left lung', 'Pulmonary vein superior (left)'): 'tributary',
    ('Superior vein of left lung', 'Pulmonary vein inferior (left)'): 'tributary',
    ('Superior basal vein of left lung', 'Pulmonary vein inferior (left)'): 'tributary',
    ('Inferior basal vein of left lung', 'Pulmonary vein inferior (left)'): 'tributary',
}
