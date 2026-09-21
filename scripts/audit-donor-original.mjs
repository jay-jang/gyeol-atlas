// Receipt and source-coordinate inspection only. Never exports runtime geometry.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import {pathToFileURL,fileURLToPath} from 'node:url';

const unzip=(file,entry)=>execFileSync('unzip',['-p',file,entry],{encoding:'utf8',maxBuffer:2**24});
const entries=file=>execFileSync('unzip',['-Z1',file],{encoding:'utf8'}).trim().split(/\r?\n/);
async function hash(file){const h=createHash('sha256');for await(const chunk of fs.createReadStream(file))h.update(chunk);return h.digest('hex');}
const decode=s=>s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[\da-f]+);/gi,e=>{
  const named={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};
  return named[e]??String.fromCodePoint(e.startsWith('&#x')?parseInt(e.slice(3,-1),16):Number(e.slice(2,-1)));
});

// Deliberately narrow reader for these six single-sheet, shared-string/numeric
// workbooks. Unsupported cells/formulas fail instead of silently misreading data.
export function worksheetRows(stringsXml,sheetXml){
  const strings=[...stringsXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map(m=>
    [...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(t=>decode(t[1])).join(''));
  const rows=[];
  for(const m of sheetXml.matchAll(/<row\s[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)){
    const cells={};
    for(const c of m[2].matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const ref=/\br="([A-Z]+)(\d+)"/.exec(c[1]);assert.ok(ref);assert.equal(Number(ref[2]),Number(m[1]));
      const body=c[2]??'';assert.ok(!/<f[\s>]/.test(body),'Formula cell unsupported');
      const v=/<v>([^<]+)<\/v>/.exec(body);if(!v){assert.equal(body.trim(),'');continue;}
      const type=/\bt="([^"]+)"/.exec(c[1])?.[1];let value;
      if(type==='s'){const index=Number(v[1]);assert.ok(Number.isInteger(index)&&index>=0&&index<strings.length);value=strings[index];}
      else {assert.ok(!type||type==='n',`Unsupported cell type ${type}`);value=Number(v[1]);assert.ok(Number.isFinite(value));}
      assert.ok(!(ref[1] in cells));cells[ref[1]]=value;
    }
    if(Object.keys(cells).length)rows.push({row:Number(m[1]),cells});
  }
  assert.ok(rows.length);return rows;
}

export async function asciiStlSummary(lines){
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  let state='start',vertices=0,triangles=0,facetVertices=0;
  for await(const raw of lines){
    const line=raw.trim();if(!line)continue;
    if(state==='start'){assert.match(line,/^solid(?:\s|$)/);state='facet';continue;}
    if(state==='facet'&&line.startsWith('endsolid')){state='done';continue;}
    if(state==='facet'){assert.match(line,/^facet normal\s/);state='loop';continue;}
    if(state==='loop'){assert.equal(line,'outer loop');state='vertices';facetVertices=0;continue;}
    if(state==='vertices'&&facetVertices===3){assert.equal(line,'endloop');state='endfacet';continue;}
    if(state==='vertices'){
      const fields=line.split(/\s+/);assert.equal(fields.shift(),'vertex');assert.equal(fields.length,3);
      const p=fields.map(Number);assert.ok(p.every(Number.isFinite));
      p.forEach((v,k)=>{min[k]=Math.min(min[k],v);max[k]=Math.max(max[k],v);});
      vertices++;facetVertices++;continue;
    }
    if(state==='endfacet'){assert.equal(line,'endfacet');triangles++;state='facet';continue;}
    assert.fail(`Unexpected STL content after ${state}`);
  }
  assert.equal(state,'done');assert.ok(triangles>0);assert.equal(vertices,triangles*3);
  return {triangles,triangleVertexOccurrences:vertices,boundsSourceMillimetres:[min,max],extentMillimetres:max.map((v,k)=>v-min[k])};
}

async function main(){
  const [originalZip,metadataZip,extractedRoot]=process.argv.slice(2);assert.ok(extractedRoot,'Pass Original ZIP, Metadata ZIP, and extraction root');
  const archiveRecords=[];
  for(const file of [originalZip,metadataZip]){
    execFileSync('unzip',['-tq',file]);
    archiveRecords.push({file:path.basename(file),bytes:fs.statSync(file).size,sha256:await hash(file),zipIntegrity:'passed',entries:entries(file)});
  }
  const stls=archiveRecords[0].entries.filter(p=>p.endsWith('.stl'));
  const kinds=Object.fromEntries(['Bone','Muscle','Cartilage','Ligament'].map(kind=>[kind,stls.filter(p=>p.includes(`_${kind}_`)).length]));
  assert.deepEqual(Object.values(kinds),[28,76,16,8]);assert.equal(stls.length,132);
  const combined=[];
  for(const entry of stls.filter(p=>p.includes('/Both/'))){
    const file=path.join(extractedRoot,entry);console.log(`Inspecting ${path.basename(file)}`);
    const summary=await asciiStlSummary(createInterface({input:fs.createReadStream(file),crlfDelay:Infinity}));
    combined.push({entry,bytes:fs.statSync(file).size,sha256:await hash(file),...summary});
  }
  assert.equal(combined.length,4);
  const workbooks=[];
  for(const entry of archiveRecords[1].entries.filter(p=>p.endsWith('.xlsx'))){
    const file=path.join(extractedRoot,entry),list=entries(file);
    assert.deepEqual(list.filter(p=>/^xl\/worksheets\/sheet\d+\.xml$/.test(p)),['xl/worksheets/sheet1.xml']);
    const rows=worksheetRows(unzip(file,'xl/sharedStrings.xml'),unzip(file,'xl/worksheets/sheet1.xml'));
    const header=rows[0].cells,data=rows.slice(1),overclosure=entry.includes('/Overclosure Data/');
    const record={entry,sha256:await hash(file),header,dataRows:data.length};
    for(const r of data){assert.equal(typeof r.cells.A,'string');assert.equal(typeof r.cells[overclosure?'C':'B'],'number');}
    if(overclosure){
      assert.equal(header.C,'Maximum Overclosure (mm)');
      const measured=data.filter(r=>r.cells.C!==1000),manual=data.filter(r=>r.cells.C===1000);
      Object.assign(record,{manualAdjustmentSentinel:1000,manualAdjustmentRows:manual.map(r=>({row:r.row,geometry1:r.cells.A,geometry2:r.cells.B})),
        maximumReportedNonSentinelMm:Math.max(...measured.map(r=>r.cells.C)),
        duplicateUnorderedPairRows:data.length-new Set(data.map(r=>[r.cells.A,r.cells.B].sort().join('|'))).size});
    }
    workbooks.push(record);
  }
  assert.equal(workbooks.length,6);
  const report={createdAt:new Date().toISOString(),status:'SOURCE RECEIVED AND INSPECTED; NO RUNTIME GEOMETRY CHANGE',
    officialSource:'https://digitalcommons.du.edu/visiblehuman/1/',license:'CC BY 4.0',archives:archiveRecords,
    inventory:{stls:stls.length,...kinds,combined:combined.length},combined,workbooks,
    limitations:['Raw lower-extremity source, not whole-body skin or missing upper-body organs.',
      'Fat_Outer combines epidermis, dermis and fat; it is not a separately segmented epidermis-only layer.',
      'Bounds and triangle syntax do not establish watertightness, correspondence, containment or anatomical alignment.',
      'Overclosure metadata describes initial processing and 1000 is a manual-adjustment sentinel, not a measured distance.',
      'Final STL and Original STL have different processing; shared source does not prove identical tissue boundaries.',
      'All and Inner are source-named combined surfaces; their exact tissue membership has not been independently validated.'],
    scriptSha256:await hash(fileURLToPath(import.meta.url))};
  const out=path.join(extractedRoot,'receipt.json');fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({out,inventory:report.inventory,combined,workbooks},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
