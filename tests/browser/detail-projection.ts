import type {Page} from '@playwright/test';

export const detailProjection=(page:Page,fiberUrl:string)=>page.evaluate(async url=>{
  const module=await import(/* @vite-ignore */ url);
  const canvas=document.querySelector('canvas')!;
  const {camera}=module._roots.get(canvas).store.getState();
  const bounds=JSON.parse(canvas.dataset.selectedWorldBounds!);
  const rect=canvas.getBoundingClientRect();
  const card=document.querySelector('.selection-card')!.getBoundingClientRect();
  const projected=[];
  for(let x=0;x<2;x++)for(let y=0;y<2;y++)for(let z=0;z<2;z++) {
    const p=camera.position.clone().set(bounds[x][0],bounds[y][1],bounds[z][2]).project(camera);
    projected.push({x:rect.left+(p.x+1)*rect.width/2,y:rect.top+(1-p.y)*rect.height/2});
  }
  const pose=JSON.parse(sessionStorage.getItem('gyeol-view-v2')!).camera;
  const left=Math.min(...projected.map(p=>p.x)),right=Math.max(...projected.map(p=>p.x));
  const bottom=Math.max(...projected.map(p=>p.y)),top=Math.min(...projected.map(p=>p.y));
  return {bottom,top,left,right,cardTop:card.top,
    clearance:Math.max(card.top-bottom,top-card.bottom,card.left-right,left-card.right),
    canvasClearance:Math.min(left-rect.left,rect.right-right,top-rect.top,rect.bottom-bottom),
    targetError:Math.max(...pose.target.map((v:number,i:number)=>Math.abs(v-(bounds[0][i]+bounds[1][i])/2)))};
},fiberUrl);
