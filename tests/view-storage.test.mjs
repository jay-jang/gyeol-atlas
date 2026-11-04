import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {initialView,viewReducer,restoreView} from '../src/view-state.ts';
import {storedView,lastPoint,rememberPoint,saveTabView,readBrowserView,LAST_POINT_KEY,VIEW_KEY} from '../src/view-storage.ts';
const ids=JSON.parse(fs.readFileSync('data/points.json')).map(p=>p.id);
const assets=JSON.parse(fs.readFileSync('scripts/model-inputs.json')).assets;
const remembered=JSON.stringify({version:1,pointId:'KI3'});

test('new visits restore a validated last point; a saved empty tab wins over durable memory',()=>{
 assert.equal(storedView(null,null,ids,assets).pointId,'');
 assert.equal(storedView(null,remembered,ids,assets).pointId,'KI3');
 const saved={...initialView(),camera:{position:[0,1,2],target:[0,1,0]},markerColor:'organ'};
 assert.deepEqual(storedView(JSON.stringify(saved),remembered,ids,assets),saved);
 assert.equal(storedView(JSON.stringify(initialView('ST36')),remembered,ids,assets).pointId,'ST36');
 for(const raw of ['garbage','null','{"version":2,"pointId":"KI3"}','{"version":1,"pointId":"FAKE"}','[]'])assert.equal(lastPoint(raw,ids),'');
 assert.equal(storedView('corrupt',remembered,ids,assets).pointId,'');
});
test('deselection preserves independent structures, details, filters, camera and marker preferences',()=>{
 const base={...initialView('KI3'),camera:{position:[0,1,2],target:[0,1,0]},markers:'selected',labels:true,markerColor:'category'};
 base.filters.organ='KI';
 const single=viewReducer(base,{type:'select',layer:'organ',selection:{kind:'structure',name:'위',ids:['FMA7148']}});
 const detail=viewReducer(base,{type:'detail',detail:{id:'heart',name:'심장',ids:['FMA7088'],layers:{...base.layers,muscle:false}}});
 for(const state of [base,single,detail]){
  const cleared=viewReducer(state,{type:'clear-point'});
  assert.deepEqual(cleared,{...state,pointId:''});
  assert.equal(viewReducer(cleared,{type:'clear-point'}),cleared);
 }
 assert.equal(restoreView(JSON.stringify(viewReducer(base,{type:'clear-point'})),ids,assets).pointId,'');
});
test('deselecting the owner of an isolated comparison ends its bundle and restores the previous scene',()=>{
 let base=viewReducer(initialView('CV12'),{type:'dissection',value:40});
 base={...base,camera:{position:[0,1,2],target:[0,1,0]},markers:'hidden',labels:true,markerColor:'organ'};
 let compared=viewReducer(base,{type:'compare',name:'위',ids:['FMA7148']});
 compared=viewReducer(compared,{type:'isolate'});
 const cleared=viewReducer(compared,{type:'clear-point'});
 for(const key of ['layers','dissection','displayMode','anatomyRegion','alpha','camera','markers','labels','markerColor','filters'])assert.deepEqual(cleared[key],base[key],key);
 assert.equal(cleared.pointId,'');assert.equal(cleared.selection,null);assert.equal(cleared.comparison,null);assert.equal(cleared.isolated,false);
});
test('browser persistence retains the last actual choice after clear and tolerates denied storage',()=>{
 const oldSession=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage'),oldLocal=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const make=()=>{const values=new Map();return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),values};};
 try{
  const session=make(),local=make();
  Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:session});Object.defineProperty(globalThis,'localStorage',{configurable:true,value:local});
  rememberPoint('KI3');rememberPoint('');saveTabView(initialView());
  assert.equal(local.getItem(LAST_POINT_KEY),remembered);assert.equal(readBrowserView(ids,assets).pointId,'');
  session.values.delete(VIEW_KEY);assert.equal(readBrowserView(ids,assets).pointId,'KI3');
  for(const name of ['sessionStorage','localStorage'])Object.defineProperty(globalThis,name,{configurable:true,get(){throw Error('denied');}});
  assert.doesNotThrow(()=>rememberPoint('ST36'));assert.doesNotThrow(()=>saveTabView(initialView()));assert.equal(readBrowserView(ids,assets).pointId,'');
 }finally{
  if(oldSession)Object.defineProperty(globalThis,'sessionStorage',oldSession);else delete globalThis.sessionStorage;
  if(oldLocal)Object.defineProperty(globalThis,'localStorage',oldLocal);else delete globalThis.localStorage;
 }
});
