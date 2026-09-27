import test from 'node:test';
import assert from 'node:assert/strict';
import {officialMeshes} from '../scripts/lib/official-meshes.mjs';

test('official triangle reader composes scene transforms, normals and existing common shift',()=>{
  const binary=Buffer.alloc(80);
  [1,0,0,0,1,0,0,0,1,1,0,0,1,0,0,1,0,0].forEach((v,i)=>binary.writeFloatLE(v,i*4));
  [0,1,2].forEach((v,i)=>binary.writeUInt16LE(v,72+i*2));
  const gltf={asset:{version:'2.0'},buffers:[{byteLength:80}],bufferViews:[{buffer:0,byteOffset:0,byteLength:36},{buffer:0,byteOffset:36,byteLength:36},{buffer:0,byteOffset:72,byteLength:6}],
    accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3'},{bufferView:1,componentType:5126,count:3,type:'VEC3'},{bufferView:2,componentType:5123,count:3,type:'SCALAR'}],
    meshes:[{primitives:[{attributes:{POSITION:0,NORMAL:1},indices:2}]}],
    nodes:[{translation:[1,2,3],children:[1]},{name:'wanted',mesh:0,rotation:[0,0,Math.SQRT1_2,Math.SQRT1_2],scale:[2,3,4]}],scenes:[{nodes:[0]}],scene:0};
  const bytes=Buffer.from(JSON.stringify(gltf)),json=Buffer.alloc(Math.ceil(bytes.length/4)*4,32);bytes.copy(json);
  const glb=Buffer.alloc(12+8+json.length+8+binary.length);
  glb.writeUInt32LE(0x46546c67,0);glb.writeUInt32LE(2,4);glb.writeUInt32LE(glb.length,8);
  glb.writeUInt32LE(json.length,12);glb.writeUInt32LE(0x4e4f534a,16);json.copy(glb,20);
  const offset=20+json.length;glb.writeUInt32LE(binary.length,offset);glb.writeUInt32LE(0x004e4942,offset+4);binary.copy(glb,offset+8);
  const mesh=officialMeshes(glb,['wanted'],[.5,.25,-.5]).get('wanted');
  assert.deepEqual([...mesh.geometry.attributes.position.array],[1.5,4.25,2.5,-1.5,2.25,2.5,1.5,2.25,6.5]);
  assert.deepEqual([...mesh.geometry.index.array],[0,1,2]);
  for(let i=0;i<3;i++){const n=mesh.geometry.attributes.normal;assert.ok(Math.abs(n.getX(i))<1e-6);assert.ok(Math.abs(n.getY(i)-1)<1e-6);assert.equal(n.getZ(i),0);}
  assert.throws(()=>officialMeshes(glb,['missing'],[0,0,0]),/Missing/);mesh.geometry.dispose();
});
