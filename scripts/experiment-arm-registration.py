"""Offline candidate fitting only: never writes deployed anatomical geometry.

Uses independent source/host skin clouds, not bone containment, for fitting.
Candidates must still be checked against joints and the complete hand geometry.
"""
import gzip
import hashlib
import json
import re
from pathlib import Path
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation
from scipy.optimize import least_squares

ROOT=Path(__file__).resolve().parents[1]
male=json.loads((ROOT/'.cache/male-details/atlas.json').read_text())
female=json.loads((ROOT/'public/models/female/atlas-female.json').read_text())
files={}
manifest_path=ROOT/'.cache/male-details/atlas.json'
assert hashlib.sha256(manifest_path.read_bytes()).hexdigest()=='d6979fc62cf18fa4f08a9e6efae8fdac9ec383c5a1f3c757920125ac758429fe'
for manifest in [manifest_path, ROOT/'public/models/female/atlas-female.json']:
    files[str(manifest.relative_to(ROOT))]=hashlib.sha256(manifest.read_bytes()).hexdigest()
def load_part(atlas,part,is_male=False):
    name=atlas['chunks'][part['chunk']]['gzip'].split('/')[-1]
    path=ROOT/('.cache/arm-registration' if is_male else 'public/models/female')/name
    files[str(path.relative_to(ROOT))]=hashlib.sha256(path.read_bytes()).hexdigest()
    compressed=path.read_bytes()
    assert len(compressed)==atlas['chunks'][part['chunk']]['gzipBytes']
    data=gzip.decompress(compressed)
    assert len(data)==atlas['chunks'][part['chunk']]['bytes']
    points=np.frombuffer(data,dtype='<f4',count=part['vertexCount']*3,offset=part['positions']).reshape(-1,3).astype(float)
    triangles=np.frombuffer(data,dtype='<u4',count=part['indexCount'],offset=part['indices']).reshape(-1,3)
    return points,triangles

def skin_arm(points,triangles,side,cut):
    # Disconnect arms from the trunk at an explicitly recorded cross-section.
    # Select the connected component containing the lateral hand, not arbitrary
    # points beyond a gap in unevenly sampled vertex coordinates.
    allowed=(points[:,1]<cut)&(points[:,0]*side>0)
    tri=triangles[allowed[triangles].all(axis=1)]
    edges=np.concatenate((tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]))
    graph=coo_matrix((np.ones(len(edges)),(edges[:,0],edges[:,1])),shape=(len(points),len(points)))
    _,labels=connected_components(graph,directed=False)
    used=np.unique(tri)
    seed=used[np.argmax(points[used,0]*side)]
    arm=points[(labels==labels[seed])&allowed]
    assert len(arm)>200,(side,cut,len(arm))
    assert arm[:,0].min()*arm[:,0].max()>0
    return arm

def isolated_arm(points,triangles,side):
    attempts=[]
    for cut in np.arange(1.30,.89,-.01):
        arm=skin_arm(points,triangles,side,cut)
        bounds=[arm.min(axis=0).tolist(),arm.max(axis=0).tolist()]
        # A distal arm component must not include the feet or median trunk.
        # These are gross segmentation guards, not anatomical landmarks.
        accepted=bool(arm[:,1].min()>.45 and (arm[:,0]*side).min()>.07)
        attempts.append({'cutY':float(cut),'points':len(arm),'bounds':bounds,'accepted':accepted})
        if accepted:return arm,float(cut),attempts
    raise ValueError(f'No independent distal arm component for side {side}: {attempts}')

def voxel(points,size=.004):
    keys=np.floor(points/size).astype(int)
    _,indices=np.unique(keys,axis=0,return_index=True)
    return points[indices]

def measure(a,b):
    distances=cKDTree(b).query(a)[0]*1000
    return {'medianMm':float(np.median(distances)),'p95Mm':float(np.quantile(distances,.95)),'maxMm':float(distances.max())}

male_skin,_=next((p,None) for p in male['parts'] if p['name']=='Skin')
mp,mt=load_part(male,male_skin,True)
female_skin=next(p for p in female['parts'] if p['name']=='Skin')
fp,ft=load_part(female,female_skin)
result={'status':'EXPERIMENT ONLY: not applied to app; skin fit is not anatomical validation',
        'sourceCommit':'5bb5713aab18d7fe9380c3339eb09f173491ea06','arms':[]}
for side,label in [(1,'Left'),(-1,'Right')]:
    source_bone=next(p for p in male['parts'] if p['name']==f'{label} humerus')
    existing_bone=next(p for p in female['parts'] if p['name']==f'{label} humerus')
    source_vertices,_=load_part(male,source_bone,True)
    existing_vertices,_=load_part(female,existing_bone)
    assert source_vertices.shape==existing_vertices.shape
    existing=np.linalg.lstsq(np.c_[source_vertices,np.ones(len(source_vertices))],existing_vertices,rcond=None)[0]
    source_error=np.max(np.linalg.norm(np.c_[source_vertices,np.ones(len(source_vertices))]@existing-existing_vertices,axis=1))
    assert source_error<1e-6,source_error
    # Validate the recovered placement on the complete arm chain, not only
    # the humerus used to recover it. Scapula/clavicle are kept fixed in the
    # candidate so a skin fit cannot silently displace the shoulder girdle.
    arm_names=re.compile(r'clavicle|scapula|humerus|radius|ulna|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|(finger|thumb)$',re.I)
    source_by_id={p['id']:p for p in male['parts']}
    chain=[]
    for part in female['parts']:
        if not part['conceptId'].startswith('BORROWED:'):continue
        donor=source_by_id[part['conceptId'].removeprefix('BORROWED:')]
        if not re.search(r'\b'+label+r'\b',donor['name'],re.I) or not arm_names.search(donor['name']):continue
        original,original_triangles=load_part(male,donor,True)
        placed,placed_triangles=load_part(female,part)
        assert np.array_equal(original_triangles,placed_triangles)
        error=float(np.max(np.linalg.norm(np.c_[original,np.ones(len(original))]@existing-placed,axis=1)))
        assert error<1e-6,(part['id'],error)
        chain.append({'id':part['id'],'sourceId':donor['id'],'name':part['name'],
                      'maxPlacementErrorMm':error*1000,
                      'transformed':not re.search('clavicle|scapula',donor['name'],re.I)})
    assert len(chain)==32 and sum(p['transformed'] for p in chain)==30,(label,len(chain),[p['name'] for p in chain])
    # Upstream rotates about the placed SOURCE bounding-box top centre. The
    # affine image of that source point recovers its invariant pivot; the top
    # of the already rotated box would be a different point. This remains a
    # geometric proxy, not a validated humeral-head articular centre.
    source_top=(np.array(source_bone['bounds'][0])+np.array(source_bone['bounds'][1]))/2
    source_top[1]=source_bone['bounds'][1][1]
    pivot=np.r_[source_top,1]@existing
    source,source_cut,source_attempts=isolated_arm(mp,mt,side)
    source=voxel(source)
    source=np.c_[source,np.ones(len(source))]@existing
    target,target_cut,target_attempts=isolated_arm(fp,ft,side)
    target=voxel(target)
    tree=cKDTree(target)
    source_reach=np.linalg.norm(source-pivot,axis=1)
    target_reach=np.linalg.norm(target-pivot,axis=1)
    a=source[source_reach>=np.quantile(source_reach,.85)].mean(axis=0)-pivot
    b=target[target_reach>=np.quantile(target_reach,.85)].mean(axis=0)-pivot
    rotation,_=Rotation.align_vectors([b/np.linalg.norm(b)],[a/np.linalg.norm(a)])
    initial=np.r_[rotation.as_rotvec(),np.log(np.linalg.norm(b)/np.linalg.norm(a))]
    def moved(params):
        return (source-pivot)@Rotation.from_rotvec(params[:3]).as_matrix().T*np.exp(params[3])+pivot
    solutions=[]
    for twist in [-60,-30,0,30,60]:
        start_rotation=Rotation.from_rotvec(b/np.linalg.norm(b)*np.deg2rad(twist))*rotation
        params=np.r_[start_rotation.as_rotvec(),initial[3]]
        for iteration in range(60):
            current=moved(params)
            _,indices=tree.query(current)
            _,reverse_indices=cKDTree(current).query(target)
            targets=target[indices]
            # Bidirectional residuals prevent a smaller source patch from
            # fitting one target area while leaving the host hand uncovered.
            balance=np.sqrt(len(source)/len(target))
            def residual(x):
                candidate=moved(x)
                return np.r_[(candidate-targets).ravel(),
                             ((candidate[reverse_indices]-target)*balance).ravel()]
            fit=least_squares(residual,params,loss='soft_l1',f_scale=.008,
                              bounds=([-np.pi]*3+[np.log(.75)],[np.pi]*3+[np.log(1.35)]),max_nfev=30)
            delta=np.linalg.norm(fit.x-params);params=fit.x
            if delta<1e-7:break
        current=moved(params)
        score=float(np.mean(tree.query(current)[0]**2)+np.mean(cKDTree(current).query(target)[0]**2))
        solutions.append((score,params,twist,iteration+1))
    _,params,chosen_twist,iterations=min(solutions,key=lambda entry:entry[0])
    transformed=moved(params)
    rotation=Rotation.from_rotvec(params[:3]).as_matrix();scale=float(np.exp(params[3]))
    # Row-vector transform: p @ linear + translation.
    linear=rotation.T*scale;translation=pivot-pivot@linear
    result['arms'].append({'side':label.lower(),'sourcePoints':len(source),'targetPoints':len(target),
        'sourceCutY':source_cut,'targetCutY':target_cut,
        'segmentation':{'source':source_attempts,'target':target_attempts},
        'existingTransformMaxErrorMm':float(source_error*1000),
        'parts':chain,
        'initialTwistDegrees':chosen_twist,'iterations':iterations,
        'multistartScores':[{'twistDegrees':s[2],'symmetricMeanSquaredDistance':s[0]} for s in solutions],
        'pivot':pivot.tolist(),'scale':scale,'rotationDegrees':float(np.linalg.norm(params[:3])*180/np.pi),
        'linear':linear.tolist(),'translation':translation.tolist(),
        'before':measure(source,target),'after':measure(transformed,target),
        'reverseAfter':measure(target,transformed)})
result['files']=[{'path':p,'sha256':h} for p,h in files.items()]
result['files'].append({'path':str(Path(__file__).relative_to(ROOT)),
                        'sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()})
out=ROOT/'.cache/arm-registration/candidates.json'
out.write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps([{k:v for k,v in arm.items() if k in ['side','scale','rotationDegrees','before','after','reverseAfter']}
                  for arm in result['arms']],indent=2))
