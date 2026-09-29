import test from 'node:test';
import assert from 'node:assert/strict';
import {besideMarker} from '../src/marker-label.ts';

const canvas={width:390,height:786}, label={width:73,height:28};
const inside=([x,y])=>x-label.width/2>=4&&x+label.width/2<=canvas.width-4&&y-label.height/2>=4&&y+label.height/2<=canvas.height-4;

test('an acupoint label keeps its outward side when it fits and never overlaps its marker gap',()=>{
  assert.deepEqual(besideMarker([200,300],-1,label,canvas),[200-10-36.5,300]);
  assert.deepEqual(besideMarker([200,300],1,label,canvas),[200+10+36.5,300]);
});

test('a label that would pass the canvas edge flips to the marker’s other side',()=>{
  // A marker 60px from the left edge leaves too little room for the label.
  const [x,y]=besideMarker([60,382],-1,label,canvas);
  assert.equal(x,60+10+36.5); assert.equal(y,382); assert.ok(inside([x,y]));
  assert.deepEqual(besideMarker([98,382],-1,label,canvas),[98-10-36.5,382]);
  const right=besideMarker([canvas.width-40,382],1,label,canvas);
  assert.equal(right[0],canvas.width-40-10-36.5); assert.ok(inside(right));
});

test('a label wider than either side is clamped inside the canvas instead of clipped',()=>{
  const wide={width:300,height:28};
  for(const marker of [[20,10],[195,780],[370,400]]) for(const side of [-1,1]) {
    const [x,y]=besideMarker(marker,side,wide,canvas);
    assert.ok(x-150>=4&&x+150<=canvas.width-4,JSON.stringify({marker,side,x}));
    assert.ok(y-14>=4&&y+14<=canvas.height-4,JSON.stringify({marker,side,y}));
  }
  const tiny=besideMarker([10,10],-1,{width:400,height:900},canvas);
  assert.deepEqual(tiny,[canvas.width/2,canvas.height/2]);
});

test('a marker outside the canvas is not pinned to the edge as if it were visible there',()=>{
  assert.deepEqual(besideMarker([-60,300],-1,label,canvas),[-60-10-36.5,300]);
  assert.deepEqual(besideMarker([200,-40],1,label,canvas),[200+10+36.5,-40]);
});
