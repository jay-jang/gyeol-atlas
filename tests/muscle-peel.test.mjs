import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {musclePeelRanks} from '../src/muscle-peel.ts';
import {musclePeelGroups,musclePeelRelations,musclePeelSources} from '../src/muscle-peel-relations.ts';
import {musclePeelOpacity,dissectionLayerOpacity} from '../src/dissection.ts';
const read=p=>JSON.parse(fs.readFileSync(p));
const male=read('scripts/model-inputs.json').assets.filter(p=>p.layer==='muscle');
const female=read('data/female-atlas-structures.json').filter(p=>p.layer==='muscle');

test('named muscle precedence references exact sex, side and source catalog members',()=>{
  assert.equal(musclePeelRelations.length,30);
  for(const group of musclePeelGroups){
    assert.ok(musclePeelSources[group.source].startsWith('https://'));
    const catalog=group.sex==='male'?male:female;
    for(const [levelIndex,level] of group.levels.entries()){
      const names=group.names[levelIndex]==='deep posterior leg'?['flexor hallucis longus','flexor digitorum longus','tibialis posterior']:[group.names[levelIndex]];
      const expected=catalog.filter(p=>new RegExp(`\\b${group.side}\\b`,'i').test(p.name)&&names.some(name=>p.name.toLowerCase().includes(name))).map(p=>p.id);
      assert.deepEqual([...level].sort(),expected.sort(),`${group.sex}/${group.side}/${group.names[levelIndex]}`);
    }
  }
});
test('all source-backed outer muscles finish fading before inner muscles fade, for every half-percent input',()=>{
  for(const input of [male,female]){
    // Deliberately contradictory heuristic scores; anatomy constraints must win.
    const ranks=musclePeelRanks(input.map((p,i)=>({id:p.id,score:i})));
    for(const [outer,inner] of musclePeelRelations){
      if(!ranks.has(outer)||!ranks.has(inner))continue;
      assert.ok(ranks.get(inner)-ranks.get(outer)>=4/36-1e-12);
      for(let tick=40;tick<=200;tick++){
        const depth=tick/2,alpha=dissectionLayerOpacity('muscle',depth);
        const a=alpha*musclePeelOpacity(depth,ranks.get(outer));
        const b=alpha*musclePeelOpacity(depth,ranks.get(inner));
        if(b<1-1e-12)assert.ok(a<1e-12,`${outer}/${inner}/${depth}`);
      }
    }
    assert.equal(ranks.size,input.length);
    for(const rank of ranks.values())assert.ok(Number.isFinite(rank)&&rank>=0&&rank<=1);
  }
});
test('peel constraints are deterministic, reject cycles/invalid input, and do not mutate inputs',()=>{
  const input=Object.freeze([Object.freeze({id:'deep',score:9}),Object.freeze({id:'outer',score:1}),Object.freeze({id:'other',score:2})]);
  const edges=[['outer','deep']];
  assert.deepEqual(musclePeelRanks(input,edges),musclePeelRanks([...input].reverse(),edges));
  assert.throws(()=>musclePeelRanks(input,[...edges,['deep','outer']]),/Cyclic/);
  assert.throws(()=>musclePeelRanks([{id:'x',score:NaN}]),/Invalid/);
  assert.throws(()=>musclePeelRanks([{id:'x',score:1},{id:'x',score:2}]),/Invalid/);
  assert.equal(musclePeelRanks([],edges).size,0);
  assert.equal(musclePeelRanks([{id:'other',score:0}],edges).get('other'),0);
});
test('the longest admissible chain fits exactly without rounding away fade separation',()=>{
  const input=Array.from({length:11},(_,i)=>({id:String(i),score:i}));
  const edges=input.slice(1).map((p,i)=>[String(i),p.id]);
  assert.throws(()=>musclePeelRanks(input,edges),/exceeds/);
  const ranks=musclePeelRanks(input.slice(0,10),edges.slice(0,9));
  for(let i=0;i<10;i++)assert.ok(Math.abs(24+ranks.get(String(i))*36-(24+4*i))<1e-10);
});
