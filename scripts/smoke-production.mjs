import assert from "node:assert/strict";
import { chromium } from "@playwright/test";
import { createApp } from "../server/index.mjs";
const server = createApp().listen(0, "127.0.0.1");
await new Promise((resolve) => server.once("listening", resolve));
const origin = process.env.SMOKE_ORIGIN || `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1100 },
  });
  const requests = [],
    errors = [];
  page.on("request", (r) => requests.push(r.url()));
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/#wiki");
  await page.getByRole("heading", { name: "위키에 물어보기" }).waitFor();
  assert.equal(
    requests.filter((r) => r.endsWith(".glb") || r.endsWith(".bin.gz") || /\/assets\/Atlas-/.test(r))
      .length,
    0,
    "Wiki must not fetch the 3D chunk or models",
  );
  await page.getByRole("link", { name: "3D 경혈 지도" }).click();
  await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 60000 });
  assert.equal(requests.filter((r) => r.endsWith(".glb")).length, 1);
  for (const name of ["근육 빠른 보기", "골격 빠른 보기", "장기 빠른 보기", "혈관 빠른 보기", "림프 빠른 보기", "신경 빠른 보기"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 60000 });
  }
  assert.equal(new Set(requests.filter((r) => r.endsWith(".glb"))).size, 9);
  await page.locator('.explore-sidebar').getByRole('button',{name:'여성',exact:true}).click();
  await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
  for (const name of ["골격 빠른 보기", "장기 빠른 보기", "혈관 빠른 보기", "림프 빠른 보기"]) {
    await page.getByRole("button", { name, exact: true }).click();
    await page.getByText("해부 모델 로드 완료").waitFor({ timeout: 60000 });
  }
  assert.equal(new Set(requests.filter((r) => r.endsWith(".glb"))).size, 9, "Female mode must not load legacy male/female overlay GLBs");
  assert.equal(new Set(requests.filter((r) => /\/female\/.*\.bin\.gz$/.test(r))).size, 15);
  await page.locator('.explore-sidebar').getByRole('button',{name:'남성',exact:true}).click();
  await page.goto(origin+'/#atlas/KI3');
  await page.locator('.point-summary').click();
  await page.getByRole('button',{name:'대응 장부의 해부 구조 비교'}).click();
  await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
  assert.match(await page.locator('.selection-card').innerText(),/2개 구조/);
  await page.getByRole('button',{name:'비교 대상만 보기'}).click();
  await page.locator('.point-summary').click();
  await page.getByRole('link',{name:'마사지 전 해부학 참고 가이드 ↗'}).click();
  await page.locator('canvas').waitFor({state:'detached'});
  assert.equal(await page.locator('canvas').count(),0);
  await page.getByRole('link',{name:/태계 3D 보기로 돌아가기/}).click();
  await page.getByText('해부 모델 로드 완료').waitFor({timeout:60000});
  assert.match(await page.locator('.selection-card').innerText(),/전체 구조 보기/);
  const result = await (
    await fetch(origin + "/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "족삼리 위치" }),
    })
  ).json();
  assert.equal(result.documents[0].id, "points/ST36");
  assert.equal((await fetch(origin + "/wiki/points/ST36.md")).status, 200);
  assert.equal(
    (await fetch(origin + "/models/LICENSE_content.txt")).status,
    200,
  );
  assert.equal(
    (await fetch(origin + "/models/LICENSE_z-anatomy.txt")).status,
    200,
  );
  assert.equal((await fetch(origin + "/models/LICENSE_hra_female.txt")).status, 200);
  assert.equal((await (await fetch(origin + '/api/health')).json()).documents,419);
  for (const [question,expected] of [['원혈 모혈 차이','point-categories'],['내부 장기 마사지 깊이','massage-anatomy']]) {
    const answer = await (await fetch(origin+'/api/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question})})).json();
    assert.equal(answer.documents[0].id,expected);
  }
  await page.goto(origin+'/#wiki/point-categories');
  await page.locator('.wiki-sidebar').getByRole('link',{name:'원혈·모혈·오수혈·낙혈의 구분',exact:true}).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "Production smoke passed: static wiki, lazy 3D chunk, 9 male GLBs and 15 independent female chunks, lymph, bundle and wiki restoration, citations API, Markdown export, attribution, zero browser errors.",
  );
} finally {
  await browser?.close();
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}
