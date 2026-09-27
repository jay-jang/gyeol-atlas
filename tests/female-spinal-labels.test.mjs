import fs from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {femaleSpinalLabel} from '../scripts/lib/female-spinal-labels.mjs';
const atlas=JSON.parse(fs.readFileSync('public/models/female/atlas-female.json'));
test('all and only the 29 source spinal segments receive ordered Korean search labels',()=>{
  const ids=atlas.concepts.find(c=>c.id==='HRA:spinal_cord').elements;
  const segments=ids.map(id=>femaleSpinalLabel(atlas.parts.find(p=>p.id===id).conceptId)).sort((a,b)=>a.order-b.order);
  assert.deepEqual(segments.map(s=>s.code),[['C',8],['T',12],['L',5],['S',4]].flatMap(([r,n])=>Array.from({length:n},(_,i)=>`${r}${i+1}`)));
  assert.deepEqual(segments.map(s=>s.order),Array.from({length:29},(_,i)=>i+1));
  assert.ok(segments.every(s=>s.label.includes('척수')));
  assert.deepEqual(femaleSpinalLabel('HRA:eigth_thoracic_spinal_cord_segment'),{code:'T8',label:'제8흉수 분절 (T8 척수)',order:16});
  for(const unknown of ['HRA:C9_segment_of_cervical_spinal_cord','HRA:fifth_sacral_spinal_cord_segment','HRA:spinal_cord','HRA:central_canal'])assert.throws(()=>femaleSpinalLabel(unknown),/Unsupported/);
});
