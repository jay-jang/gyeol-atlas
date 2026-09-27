import assert from 'node:assert/strict';
// Unsigned-byte NRRD, list axis first (fastest), then X/Y/Z. Byte-stream
// accounting deliberately handles chunks splitting both voxels and layers.
export function labelAccumulator(sizes,labels){
  assert.equal(sizes.length,4);assert.ok(sizes.every(n=>Number.isSafeInteger(n)&&n>0));
  const [layers,nx,ny,nz]=sizes,expected=layers*nx*ny*nz;assert.ok(Number.isSafeInteger(expected));
  const lookup=new Map(),rows=labels.map(l=>({...l,voxels:0,min:[Infinity,Infinity,Infinity],max:[-Infinity,-Infinity,-Infinity]}));
  for(const r of rows){const key=r.layer*256+r.labelValue;assert.ok(r.layer>=0&&r.layer<layers&&r.labelValue>0&&r.labelValue<256);assert.ok(!lookup.has(key));lookup.set(key,r);}
  let offset=0;
  return {
    push(buffer){
      assert.ok(offset+buffer.length<=expected,'NRRD byte count exceeds dimensions');
      for(let i=0;i<buffer.length;){
        if(i+4<=buffer.length&&buffer.readUInt32LE(i)===0){i+=4;continue;}
        const value=buffer[i],absolute=offset+i;i++;
        if(value===0)continue;
        const layer=absolute%layers,row=lookup.get(layer*256+value);assert.ok(row,`Unlisted label ${layer}/${value}`);
        const voxel=Math.floor(absolute/layers),x=voxel%nx,y=Math.floor(voxel/nx)%ny,z=Math.floor(voxel/(nx*ny));
        row.voxels++;for(const [axis,n] of [x,y,z].entries()){row.min[axis]=Math.min(row.min[axis],n);row.max[axis]=Math.max(row.max[axis],n);}
      }
      offset+=buffer.length;
    },
    finish(){assert.equal(offset,expected,'NRRD byte count differs from dimensions');assert.ok(rows.every(r=>r.voxels>0),'Empty source label');return {bytes:offset,rows};},
  };
}
