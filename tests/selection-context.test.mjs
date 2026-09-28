import test from 'node:test';
import assert from 'node:assert/strict';
import {initialView,viewReducer,restoreView} from '../src/view-state.ts';
import {contextIsDimmed,selectionOpacity,selectionHitId} from '../src/selection-context.ts';
const selection={kind:'structure',ids:['organ'],name:'test'};
const selected=()=>viewReducer(initialView(),{type:'select',layer:'organ',selection});

test('single selection dims context without overwriting opacity, layers, camera or marker settings',()=>{
  const before={...initialView(),alpha:{...initialView().alpha,organ:.08},camera:{position:[0,1,2],target:[0,1,0]},markers:'hidden'};
  const state=viewReducer(before,{type:'select',layer:'organ',selection});
  assert.equal(contextIsDimmed(state),true);
  assert.equal(selectionOpacity(1,false,true),.12);
  assert.equal(selectionOpacity(.08,false,true),.08);
  assert.equal(selectionOpacity(.005,false,true),.005);
  assert.equal(selectionOpacity(.08,true,true),1);
  const solid=viewReducer(state,{type:'fade-context',value:false});
  assert.deepEqual(solid,{...state,fadeContext:false});assert.equal(contextIsDimmed(solid),false);
  assert.equal(selectionOpacity(.8,false,false),.8);
  for(const action of [{type:'clear-selection'},{type:'dissection',value:66.5},{type:'stage',index:4},{type:'anatomy-region',value:'pelvis'}]){
    const next=viewReducer(state,action);assert.equal(contextIsDimmed(next),false);
    assert.deepEqual(next.alpha,state.alpha);assert.deepEqual(next.camera,state.camera);assert.equal(next.markers,state.markers);
  }
});

test('bundles, comparisons and isolation do not inherit single-structure context dimming',()=>{
  for(const extras of [{selection:null},{selection:{...selection,kind:'bundle'}},{selection:{...selection,ids:['a','b']}},{comparison:{...selection,pointId:''}},{isolated:true}])
    assert.equal(contextIsDimmed({...selected(),...extras}),false);
  const off=viewReducer(selected(),{type:'fade-context',value:false});
  assert.equal(viewReducer(off,{type:'sex',value:'female'}).fadeContext,false);
  assert.equal(viewReducer(off,{type:'select',selection,layer:'organ'}).fadeContext,false);
});

test('old sessions default safely; explicit context preference survives restoration and wiki snapshots',()=>{
  const assets=[{id:'organ',layer:'organ'}];
  const old=selected();delete old.fadeContext;
  assert.equal(restoreView(JSON.stringify(old),[],assets).fadeContext,true);
  for(const fadeContext of [true,false]){
    const s={...selected(),fadeContext};assert.deepEqual(restoreView(JSON.stringify(s),[],assets),s);
  }
  for(const value of [null,0,'false',{}])assert.deepEqual(restoreView(JSON.stringify({...selected(),fadeContext:value}),[],assets),initialView());
});

test('translucent context does not steal a hit on the emphasized selected surface',()=>{
  const hit=name=>({object:{name}}),hits=[hit('foreground'),hit('chosen')];
  assert.equal(selectionHitId('foreground',hits,['chosen'],true),'chosen');
  assert.equal(selectionHitId('foreground',hits,['chosen'],false),'foreground');
  assert.equal(selectionHitId('foreground',[hit('foreground')],['chosen'],true),'foreground');
  assert.equal(selectionHitId('foreground',[{object:{name:'surface',parent:{name:'chosen'}}}],['chosen'],true),'chosen');
});
