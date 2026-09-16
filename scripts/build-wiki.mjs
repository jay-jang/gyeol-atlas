import fs from "node:fs/promises";
const read = async (p) => JSON.parse(await fs.readFile(p, "utf8"));
const points = await read("data/points.json"),
  meridians = await read("data/meridians.json");
const concepts = await read("data/concepts.json"),
  pointConcepts = await read("data/point-concepts.json");
const theory = await read("data/acupoint-theory.json");
const docs = [];
for (const p of points) {
  const meridian = meridians.find((m) => m.id === p.meridian);
  const concept = pointConcepts[p.id];
  const categories = concept.categories
    .map((id) => concepts.find((c) => c.id === id).name)
    .join(" · ");
  const conceptText = `## 경혈 분류와 장부 대응\n\n${categories || "일반 경혈"}${concept.shuType ? " · " + concept.shuType : ""}. ${concept.traditionalName ? "전통적 장부 대응: " + concept.traditionalName + ". " : ""}전통적 분류는 압력 전달이나 장기 마사지 효과를 뜻하지 않습니다. [분류표와 출처](#wiki/point-categories) · [마사지 해부학 참고](#wiki/massage-anatomy)\n\n`;
  const t = theory[p.id];
  const locationReference = `[KMCRIC ${p.id} 위치 원문](${p.nameSource})${p.page ? ` · [WHO 위치 표준 p. ${p.page}](https://iris.who.int/handle/10665/353407)` : ""}; 영문 병기를 간추린 짧은 위치 참고입니다. 전문가 미검수이며 공식 번역이나 3D 좌표 표준이 아닙니다.`;
  const uses = p.traditionStatus === "landmark-only" ? "유중(ST17)은 가슴 경혈의 위치를 가늠하는 기준점으로 설명됩니다. 치료 효능을 부여하지 않았습니다." : `${p.traditionalIndications.join(" · ")}. 문헌에 기재된 전통적 용도의 일부를 간추렸습니다. 특정 경혈의 임상 효과가 입증되었다는 뜻은 아닙니다.`;
  const body = `# ${p.name} ${p.id}\n\n${p.hanja} · ${p.pinyin} · ${meridian.name} · ${p.bodyRegion}\n\n${p.catalogue === "extra" ? "표준 경외기혈 48개 중 한 항목" : "정규 361경혈 중 한 항목"} · 모델 표식 ${p.markerCount}곳. 이름 수와 양측·복수 위치의 표식 수는 다릅니다.\n\n## 위치 참고\n\n${p.location}\n\n${locationReference}\n\n## 전통적으로 언급된 용도\n\n${uses}\n\n[항목별 용도 출처](${p.traditionSourceUrl}). ${p.traditionLicense ? "TCM Wiki의 설명을 한국어로 간추리고 편집했습니다. [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)." : "eLotus CORE의 소골공 용도 설명을 짧게 간추렸습니다."}\n\n## 음양오행\n\n| 구분 | 배속 |\n| --- | --- |\n| 경맥 음양 | ${t.yinYang || "별도 배속 없음"} |\n| 경맥 오행 | ${t.channelElement || "별도 배속 없음"} |\n| 개별 오수혈 | ${t.fiveShu ? t.fiveShu.type + " · " + t.fiveShu.element : "해당 없음"} |\n\n${t.explanation} 장부 대응은 현대 해부 구조와 같지 않습니다. [음양오행 안내](#wiki/yin-yang-five-phases).\n\n${conceptText}## 해부학적 연결\n\n${p.structures.length ? `기준점 또는 같은 부위의 참조 메쉬: ${p.structures.join(", ")}.` : "이 경혈의 개별 기준점 메쉬는 아직 연결하지 않았습니다."} 참조 관계는 압력 전달 경로나 치료 기전이 아닙니다.\n\n## 지도에서 보기\n\n[${p.name} 3D 위치 열기](#atlas/${p.id})\n\n${p.markerNote} ${p.reviewStatus}. [좌표의 한계와 검수 방법](#wiki/coordinate-method)\n\n## 연결 문서\n\n${p.related.map(id => `[${points.find(x => x.id === id).name} ${id}](#wiki/points/${id})`).join(" · ")}${p.related.length ? " · " : ""}[골도분촌](#wiki/cun) · [근거 해석](#wiki/evidence)\n`;
  const doc = {
    id: `points/${p.id}`,
    title: `${p.name} ${p.id}`,
    category: "경혈",
    sourceIds: [
      ...new Set([
        ...p.sourceIds,
        ...(concept.categories.length ? ["point-categories"] : []),
      ]),
    ],
    pointId: p.id,
    body,
    updated: "2026-09-16",
    reviewStatus: p.reviewStatus,
  };
  docs.push(doc);
  await fs.writeFile(
    `wiki/points/${p.id}.md`,
    `---\nid: points/${p.id}\ntitle: ${doc.title}\ncategory: 경혈\nsources: ${doc.sourceIds.join(",")}\nreview: illustrative-unreviewed\n---\n${body}`,
  );
}
for (const file of (await fs.readdir("wiki/topics"))
  .filter((f) => f.endsWith(".md"))
  .sort()) {
  const raw = await fs.readFile(`wiki/topics/${file}`, "utf8");
  const [, front, body] = raw.split("---\n");
  const meta = Object.fromEntries(
    front
      .trim()
      .split("\n")
      .map((l) => {
        const i = l.indexOf(":");
        return [l.slice(0, i), l.slice(i + 1).trim()];
      }),
  );
  docs.push({
    id: meta.id,
    title: meta.title,
    category: meta.category,
    sourceIds: meta.sources.split(","),
    body,
    updated: meta.updated || "2026-09-08",
    reviewStatus: "AI 작성 · 전문가 미검수",
  });
}
const ids = new Set(docs.map((d) => d.id));
for (const d of docs) {
  d.links = [...d.body.matchAll(/\]\(#wiki\/([^)]*)\)/g)].map((m) => m[1]);
  for (const id of d.links)
    if (!ids.has(id)) throw Error(`Broken wiki link: ${d.id} -> ${id}`);
  d.backlinks = docs
    .filter((x) => x.body.includes(`](#wiki/${d.id})`))
    .map((x) => x.id);
}
await fs.mkdir("public/wiki", { recursive: true });
await fs.writeFile("data/wiki.json", JSON.stringify(docs, null, 2) + "\n");
await fs.writeFile(
  "public/wiki/index.json",
  JSON.stringify(docs, null, 2) + "\n",
);
await fs.writeFile(
  "public/llms.txt",
  `# 결 GYEOL\n\n한국어 해부학·경혈 학습 위키. AI 초안, 전문가 미검수. 3D 좌표는 학습용 근사. 자침·진단에 사용하지 않는다.\n\n- [구조화된 전체 위키](./wiki/index.json)\n- [경혈 데이터](./wiki/points.json)\n- [출처](./wiki/sources.json)\n- [모델·라이선스](./models/manifest.json)\n\n${docs.map((d) => `- [${d.title}](./wiki/${d.id}.md)`).join("\n")}\n`,
);
for (const d of docs) {
  const p = `public/wiki/${d.id}.md`;
  await fs.mkdir(p.slice(0, p.lastIndexOf("/")), { recursive: true });
  await fs.writeFile(p, d.body);
}
await fs.copyFile("data/points.json", "public/wiki/points.json");
await fs.copyFile("data/sources.json", "public/wiki/sources.json");
console.log(`Built ${docs.length} wiki articles; internal links verified.`);
