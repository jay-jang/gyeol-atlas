import assert from 'node:assert/strict';
import {BufferGeometry,BufferAttribute,Matrix3,Matrix4,Quaternion,Vector3} from 'three';

// Narrow reader for the already SHA-pinned, uncompressed HRA triangle meshes.
// Reject unsupported primitive/accessor forms rather than silently reinterpret.
export function officialMeshes(bytes,names,translation){
  assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const gltf=JSON.parse(bytes.subarray(20,20+length)),start=20+length;
  assert.equal(bytes.readUInt32LE(start+4),0x004e4942);
  const bin=bytes.subarray(start+8,start+8+bytes.readUInt32LE(start)),wanted=new Set(names),result=new Map(),seen=new Set();
  const shift=new Vector3(...translation);assert.ok(shift.toArray().every(Number.isFinite));
  function accessor(index,type){
    const a=gltf.accessors[index],v=gltf.bufferViews[a.bufferView];
    assert.equal(a.type,type);assert.ok(!a.sparse&&!a.normalized);assert.equal(v.buffer||0,0);
    const widths={5121:1,5123:2,5125:4,5126:4},reads={5121:'readUInt8',5123:'readUInt16LE',5125:'readUInt32LE',5126:'readFloatLE'};
    const width=widths[a.componentType],components=type==='VEC3'?3:1;assert.ok(width);
    if(type==='VEC3')assert.equal(a.componentType,5126);else assert.notEqual(a.componentType,5126);
    const offset=(v.byteOffset||0)+(a.byteOffset||0),stride=v.byteStride||width*components;
    assert.ok(stride>=width*components&&a.count>0);
    assert.ok((a.byteOffset||0)+(a.count-1)*stride+width*components<=v.byteLength);
    assert.ok((v.byteOffset||0)+v.byteLength<=bin.length);
    return {count:a.count,values:Array.from({length:a.count*components},(_,i)=>bin[reads[a.componentType]](offset+Math.floor(i/components)*stride+(i%components)*width))};
  }
  function walk(index,parent){
    assert.ok(!seen.has(index),'Repeated scene node');seen.add(index);
    const node=gltf.nodes[index],local=node.matrix?new Matrix4().fromArray(node.matrix):new Matrix4().compose(new Vector3(...(node.translation||[0,0,0])),new Quaternion(...(node.rotation||[0,0,0,1])),new Vector3(...(node.scale||[1,1,1])));
    const world=parent.clone().multiply(local);assert.ok(world.elements.every(Number.isFinite));
    if(wanted.has(node.name)){
      assert.ok(!result.has(node.name));const primitives=gltf.meshes[node.mesh].primitives;assert.equal(primitives.length,1);
      const p=primitives[0];assert.equal(p.mode??4,4);assert.ok(!p.extensions?.KHR_draco_mesh_compression);
      const a=accessor(p.attributes.POSITION,'VEC3'),indices=p.indices===undefined?Array.from({length:a.count},(_,i)=>i):accessor(p.indices,'SCALAR').values;
      assert.equal(indices.length%3,0);assert.ok(indices.every(i=>i>=0&&i<a.count));
      const positions=new Float32Array(a.values.length),point=new Vector3();
      for(let i=0;i<a.count;i++){
        point.fromArray(a.values,i*3).applyMatrix4(world).add(shift);assert.ok(point.toArray().every(Number.isFinite));point.toArray(positions,i*3);
      }
      const geometry=new BufferGeometry();geometry.setAttribute('position',new BufferAttribute(positions,3));geometry.setIndex(indices);
      if(p.attributes.NORMAL!==undefined){
        const normal=accessor(p.attributes.NORMAL,'VEC3');assert.equal(normal.count,a.count);
        const normalMatrix=new Matrix3().getNormalMatrix(world),values=new Float32Array(normal.values.length);
        for(let i=0;i<normal.count;i++){
          point.fromArray(normal.values,i*3).applyNormalMatrix(normalMatrix);assert.ok(point.toArray().every(Number.isFinite));point.toArray(values,i*3);
        }
        geometry.setAttribute('normal',new BufferAttribute(values,3));
      }
      result.set(node.name,{name:node.name,nodeIndex:index,worldMatrix:world.toArray(),geometry});
    }
    for(const child of node.children||[])walk(child,world);
  }
  for(const node of gltf.scenes[gltf.scene||0].nodes)walk(node,new Matrix4());
  assert.equal(result.size,wanted.size,'Missing requested source meshes');return result;
}
