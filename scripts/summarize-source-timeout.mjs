// Extract operation timing, not anatomy payloads, from the preserved failure.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const path=process.argv[2]||'.cache/foot-registration/first-frame-failure/trace.zip';
const bytes=execFileSync('unzip',['-p',path,'1-trace.trace'],{maxBuffer:32*1024*1024});
const rows=bytes.toString().trim().split('\n').map(JSON.parse);
const after=new Map(rows.filter(r=>r.type==='after').map(r=>[r.callId,r]));
const operations=rows.filter(r=>r.type==='before'&&['evaluateExpression','expect','click'].includes(r.method)).map(b=>{
  const a=after.get(b.callId),samples=a?.result?.value?.a;
  return {callId:b.callId,method:b.method,startMs:b.startTime,endMs:a?.endTime??null,
    elapsedMs:a?a.endTime-b.startTime:null,expression:b.params?.expression,selector:b.params?.selector,
    hasRecordedCompletion:Boolean(a),hasRecordedResult:Boolean(a?.result),error:a?.error??null,
    frameSizes:Array.isArray(samples)?samples.map(f=>f.o?.length??null):undefined};
});
const pending=operations.filter(r=>r.method==='evaluateExpression'&&!r.hasRecordedCompletion);
const final=operations.at(-1);
assert.ok(final?.method==='evaluateExpression'&&!final.hasRecordedCompletion&&final.expression==='() => window.__drawSamples',
  'This report only interprets a trace ending in an incomplete full draw-sample query');
const report={status:'The trace does not establish missing target rendering',
  finding:'The final full __drawSamples evaluation has a before event but no recorded after/result; no returned false observation proves draw absence.',
  limitations:['An incomplete traced operation does not identify GPU, main-thread, serialization, transport or test-runner causality.',
    'Earlier successful frame snapshots do not establish the final transition state.'],
  source:{path,sha256:createHash('sha256').update(fs.readFileSync(path)).digest('hex'),entry:'1-trace.trace',entrySha256:createHash('sha256').update(bytes).digest('hex')},
  pending,operations:operations.slice(-22)};
fs.mkdirSync('.cache/source-scheduling',{recursive:true});
fs.writeFileSync('.cache/source-scheduling/previous-timeout-summary.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({pending:report.pending,operations:report.operations.length}));
