import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {musclePeelRanks} from '../src/muscle-peel.ts';
import {musclePeelGroups,musclePeelRelations,musclePeelSources} from '../src/muscle-peel-relations.ts';
import {musclePeelOpacity,dissectionLayerOpacity} from '../src/dissection.ts';
const read=p=>JSON.parse(fs.readFileSync(p));
const male=read('scripts/model-inputs.json').assets.filter(p=>p.layer==='muscle');
const female=read('data/female-atlas-structures.json').filter(p=>p.layer==='muscle');

test('anterior-thigh schedules use actual sourced meshes and correct the female reversal',()=>{
  const report=read('docs/anatomy-alignment/muscle-peel-audit.json');
  const atlas=read('public/models/female/atlas-female.json');
  assert.deepEqual(report.sexes.map(s=>[s.sex,s.meshes,s.relations,s.afterViolations]),
    [['male',437,82,0],['female',92,20,0]]);
  const expected=[
    ['male','FMA38928','FMA38934',false],['male','FMA38929','FMA38935',false],
    ['female','HRAF0394','VHF0013',true],['female','VHF0009','VHF0013',true],
    ['female','HRAF0396','VHF0051',true],['female','VHF0047','VHF0051',true],
  ];
  for(const [sex,outer,inner,reversed] of expected){
    const row=report.sexes.find(s=>s.sex===sex).relationDetails.find(r=>r.outer===outer&&r.inner===inner);
    assert.ok(row,`${outer}/${inner}`);
    assert.equal(row.beforeReversed,reversed);
    assert.equal(row.afterSeparated,true);
    assert.ok(row.after[0]+4<=row.after[1]+1e-10);
    for(let tick=0;tick<=200;tick++){
      const depth=tick/2,layer=dissectionLayerOpacity('muscle',depth);
      const outerAlpha=layer*musclePeelOpacity(depth,(row.after[0]-24)/36);
      const innerAlpha=layer*musclePeelOpacity(depth,(row.after[1]-24)/36);
      if(innerAlpha<layer-1e-12)assert.ok(outerAlpha<1e-12,`${outer}/${inner}/${depth}`);
    }
  }
  for(const [outer,inner] of [['HRAF0394','VHF0013'],['VHF0009','VHF0013'],['HRAF0396','VHF0051'],['VHF0047','VHF0051']]){
    const a=atlas.parts.find(p=>p.id===outer),b=atlas.parts.find(p=>p.id===inner);
    assert.ok(a&&b);
    // Gross local overlap and the declared anterior axis; not surface-depth proof.
    for(const axis of [0,1])assert.ok(a.bounds[0][axis]<b.bounds[1][axis]&&b.bounds[0][axis]<a.bounds[1][axis]);
    assert.ok((a.bounds[0][2]+a.bounds[1][2])/2>(b.bounds[0][2]+b.bounds[1][2])/2);
  }
  for(const file of report.files)assert.equal(createHash('sha256').update(fs.readFileSync(file.path)).digest('hex'),file.sha256,file.path);
});

test('anterior forearm removes four actual heuristic reversals without changing female membership',()=>{
  const groups=musclePeelGroups.filter(group=>group.source==='anteriorForearm');
  assert.deepEqual(groups.map(group=>[group.sex,group.side,group.levels.map(level=>level.length)]),
    [['male','right',[6,2,3]],['male','left',[6,2,3]]]);
  const middle=new Set(groups.flatMap(group=>group.levels[1]));
  const report=read('docs/anatomy-alignment/muscle-peel-audit.json');
  const rows=report.forearmPrevious.relationDetails;
  assert.equal(rows.length,36);
  assert.ok(rows.every(row=>middle.has(row.outer)||middle.has(row.inner)));
  assert.equal(rows.filter(row=>row.previousReversed).length,4);
  assert.equal(rows.filter(row=>row.previousOverlapping).length,11);
  assert.ok(rows.every(row=>row.afterSeparated));
  for(const row of rows)for(let tick=0;tick<=200;tick++){
    const depth=tick/2,layer=dissectionLayerOpacity('muscle',depth);
    const outer=layer*musclePeelOpacity(depth,(row.after[0]-24)/36);
    const inner=layer*musclePeelOpacity(depth,(row.after[1]-24)/36);
    if(inner<layer-1e-12)assert.ok(outer<1e-12,`${row.outer}/${row.inner}/${depth}`);
  }
  assert.equal(report.sexes.find(sex=>sex.sex==='female').relations,20);
});

test('named muscle precedence references exact sex, side and source catalog members',()=>{
  assert.equal(musclePeelRelations.length,102);
  assert.equal(new Set(musclePeelGroups.flatMap(g=>g.levels.flat())).size,98);
  for(const group of musclePeelGroups){
    assert.ok(musclePeelSources[group.source].startsWith('https://'));
    const catalog=group.sex==='male'?male:female;
    for(const [levelIndex,level] of group.levels.entries()){
      const names=group.names[levelIndex]==='deep posterior leg'?['flexor hallucis longus','flexor digitorum longus','tibialis posterior']
        : Array.isArray(group.names[levelIndex])?group.names[levelIndex]:[group.names[levelIndex]];
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
