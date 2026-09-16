import test from "node:test";
import assert from "node:assert/strict";
import {
  retrieve,
  fallback,
  ask,
  validateGenerated,
} from "../server/knowledge.mjs";
import { createApp } from "../server/index.mjs";
test("retrieves Korean particles, aliases and paired point questions", () => {
  assert.equal(
    retrieve("족삼리는 어떤 해부 구조와 연결되나요?")[0].pointId,
    "ST36",
  );
  assert.equal(retrieve("LI 4 위치")[0].pointId, "LI4");
  assert.equal(retrieve("Hegu")[0].pointId, "LI4");
  const pair = retrieve("내관과 외관").map((d) => d.pointId);
  assert.ok(pair.includes("PC6"));
  assert.ok(pair.includes("TE5"));
  assert.equal(retrieve("B-cun이란?")[0].id, "cun");
  assert.equal(retrieve("라이브러리 비교")[0].id, "library-comparison");
  assert.equal(retrieve("모델 좌표 정확도")[0].id, "coordinate-method");
});
test("no evidence is explicit and procedures stay out of the educational assistant", () => {
  assert.equal(fallback("양자 중력 블랙홀").mode, "no-evidence");
  assert.equal(fallback("족삼리 자침 깊이").mode, "scope");
});
test("provider is optional, successful generations carry whitelisted citations", async () => {
  assert.equal((await ask("족삼리 위치", { model: "" })).mode, "retrieval");
  let calls = 0;
  const result = await ask("족삼리 위치", {
    model: "test",
    fetcher: async (url, init) => {
      calls++;
      assert.equal(url, "http://127.0.0.1:11434/api/chat");
      const body = JSON.parse(init.body);
      assert.equal(body.stream, false);
      assert.ok(body.messages[1].content.includes("ST36"));
      return new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              answer: [
                {
                  text: "족삼리는 앞정강근 위에 위치한다고 설명됩니다.",
                  citations: ["points/ST36"],
                },
              ],
            }),
          },
        }),
        { status: 200 },
      );
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.mode, "llm");
  assert.equal(result.answer[0].citations[0], "points/ST36");
});
test("timeouts, invalid JSON and fabricated citation IDs fall back without pretending generation", async () => {
  for (const fetcher of [
    async () => {
      throw Error("timeout");
    },
    async () => new Response("oops"),
    async () =>
      new Response(
        JSON.stringify({
          message: {
            content: JSON.stringify({
              answer: [{ text: "bad", citations: ["invented"] }],
            }),
          },
        }),
      ),
  ]) {
    const result = await ask("족삼리 위치", { model: "test", fetcher });
    assert.equal(result.mode, "retrieval");
    assert.equal(result.providerError, true);
  }
  assert.equal(
    validateGenerated(
      { answer: [{ text: "uncited", citations: [] }] },
      retrieve("족삼리"),
    ),
    false,
  );
});
test("HTTP boundary validates payloads and serves evidence results", async () => {
  const server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(
      (await (await fetch(url + "/api/health")).json()).documents,
      419,
    );
    for (const question of [null, "", "x".repeat(1001), ["ST36"]]) {
      const r = await fetch(url + "/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      assert.equal(r.status, 400);
    }
    const r = await fetch(url + "/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "족삼리 위치" }),
    });
    assert.equal(r.status, 200);
    assert.equal((await r.json()).documents[0].id, "points/ST36");
    assert.equal((await fetch(url + "/api/missing")).status, 404);
    const malformed = await fetch(url + "/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });
    assert.equal(malformed.status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});

test("expanded concepts and massage reference retrieve grounded guides", async () => {
  assert.equal(retrieve("원혈 모혈 차이")[0].id, "point-categories");
  assert.equal(retrieve("혈관 신경 단계 보기")[0].id, "layer-guide");
  assert.equal(retrieve("마사지 참고")[0].id, "massage-anatomy");
  const result = await ask("장기까지 마사지하는 압력과 깊이", {
    model: "test",
    fetcher: () => {
      throw Error("must not request procedure generation");
    },
  });
  assert.equal(result.mode, "scope");
  assert.ok(result.documents.some((d) => d.id === "massage-anatomy"));
});
