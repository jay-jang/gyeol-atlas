"""Inventory pinned SCI segmentation without assigning unverified tissue IDs."""
import collections
import gzip
import hashlib
import json
from pathlib import Path
import xml.etree.ElementTree as ET
import zipfile

FOLDER=Path('.cache/sci-head')
PINS={'Segmentation.zip':'31b7f32628a887bb8e5e089bc98e355cbb30f94b8d4cf52685a58449068ec021',
      'Simulations.zip':'ca375ae4cb6d289a2e8d68dfb9754bad83312bee7f4127f3df18be642d2ccf79'}

def audit():
    files=[];archives={}
    for name,pin in PINS.items():
        raw=(FOLDER/name).read_bytes();assert hashlib.sha256(raw).hexdigest()==pin
        with zipfile.ZipFile(FOLDER/name) as z:
            assert z.testzip() is None
            archives[name]={n:z.read(n) for n in z.namelist() if n.endswith(('.nrrd','.txt','.srn')) and not Path(n).name.startswith('._')}
        files.append(dict(url='https://sci.utah.edu/~datasets/SCI_headmodel/'+name,bytes=len(raw),sha256=pin,
                          entries=[dict(path=n,bytes=len(b),sha256=hashlib.sha256(b).hexdigest()) for n,b in archives[name].items()]))
    nrrd=archives['Segmentation.zip']['Segmentation/HeadSegmentation.nrrd']
    header,packed=nrrd.split(b'\n\n',1);lines=header.decode().splitlines();assert lines[0]=='NRRD0005'
    fields=dict(line.split(': ',1) for line in lines[1:] if line and not line.startswith('#'))
    assert fields['type']=='unsigned char' and fields['dimension']=='3' and fields['encoding']=='gzip'
    assert fields['sizes']=='208 256 256' and fields['space directions']=='(1,0,0) (0,1,0) (0,0,1)'
    assert fields['space']=='3D-right-handed' and fields['centerings']=='cell cell cell'
    voxels=gzip.decompress(packed);assert len(voxels)==208*256*256
    counts=collections.Counter(voxels);assert set(counts)==set(range(1,9))
    boxes={label:[[208,256,256],[-1,-1,-1]] for label in counts}
    for index,label in enumerate(voxels):
        x=index%208;y=index//208%256;z=index//(208*256)
        low,high=boxes[label]
        for axis,value in enumerate((x,y,z)):
            low[axis]=min(low[axis],value);high[axis]=max(high[axis],value)
    network=ET.fromstring(archives['Simulations.zip']['Simulations/LeadFieldMatrix.srn'])
    evidence=[]
    for module in network.iter('module'):
        note=module.findtext('note','')
        if 'Set conductivities' in note or 'Clip out brain' in note:
            evidence.append(dict(moduleId=module.attrib['id'],name=module.attrib['name'],note=note,
                                 variables={v.attrib['name']:v.attrib['val'] for v in module.findall('var') if v.attrib['name'] in ('function','data','rlabel','rows','cols')}))
    assert len(evidence)==2
    report=dict(status='SOURCE RECEIVED; voxel labels not yet authoritatively mapped; no runtime export',
                sourcePage='https://sci.utah.edu/sci-head-model/',paperDoi='10.1101/552190',files=files,
                nrrdHeader=fields,voxelBytes=len(voxels),voxelSha256=hashlib.sha256(voxels).hexdigest(),
                labels=[dict(value=label,voxels=counts[label],indexBoundsXYZ=boxes[label],anatomicalName=None) for label in sorted(counts)],
                meshNetworkEvidence=evidence,
                limitations=['The source describes a female head and eight material classes; the downloaded NRRD and README do not name their numeric values.',
                             'Do not copy the Cleaver mesh conductivity-table row indices onto the NRRD labels. Their geometric support differs and the crosswalk is unverified.',
                             'NRRD space is generic 3D-right-handed, not explicit RAS/LPS. Anatomical axis orientation and physical units require source-image correspondence.',
                             'The paper describes synthetic MRI-derived bone and represents the mouth as solid bone due to dental artifacts; it is not a detailed normal dental/jaw model.',
                             'The official page permits public access and asks for acknowledgement. The paper CC BY notice is not automatically the data license.',
                             'No surface extraction, HRA placement, cranial-nerve detail, whole-body completion or clinical accuracy is claimed.'],
                codeSha256=hashlib.sha256(Path(__file__).read_bytes()).hexdigest())
    (FOLDER/'inventory.json').write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps(dict(voxelBytes=len(voxels),labels=report['labels'],meshNetworkEvidence=evidence)))

if __name__=='__main__':audit()
