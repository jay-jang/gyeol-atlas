import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ask, docs } from "./knowledge.mjs";
export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "8kb" }));
  const buckets = new Map();
  let active = 0;
  app.get("/api/health", (_req, res) =>
    res.json({
      ok: true,
      documents: docs.length,
      providerConfigured: !!process.env.OLLAMA_MODEL,
    }),
  );
  app.post("/api/ask", async (req, res) => {
    const q = req.body?.question;
    if (typeof q !== "string" || !q.trim() || q.length > 1000)
      return res
        .status(400)
        .json({ error: "질문은 1–1000자로 입력해 주세요." });
    const now = Date.now();
    for (const [ip, b] of buckets)
      if (now - b.start > 60000) buckets.delete(ip);
    const ip = req.ip;
    const b = buckets.get(ip) || { start: now, count: 0 };
    b.count++;
    buckets.set(ip, b);
    if (b.count > 30 || active >= 2)
      return res
        .status(429)
        .json({ error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." });
    active++;
    const abort = new AbortController();
    res.on("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    try {
      const result = await ask(q.trim(), { signal: abort.signal });
      if (!abort.signal.aborted) res.json(result);
    } catch {
      if (!res.headersSent)
        res.status(500).json({ error: "검색 중 오류가 발생했습니다." });
    } finally {
      active--;
    }
  });
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "API not found" }),
  );
  const dist = fileURLToPath(new URL("../dist/", import.meta.url));
  app.use(express.static(dist));
  app.get("/{*path}", (_req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
  app.use((err, _req, res, _next) =>
    res
      .status(err.status || 500)
      .json({
        error:
          err.type === "entity.too.large"
            ? "요청 크기가 너무 큽니다."
            : "요청을 처리하지 못했습니다.",
      }),
  );
  return app;
}
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
)
  createApp().listen(
    Number(process.env.PORT || 3001),
    process.env.HOST || "127.0.0.1",
    () =>
      console.log(
        `GYEOL server http://${process.env.HOST || "127.0.0.1"}:${process.env.PORT || 3001}`,
      ),
  );
