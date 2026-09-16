export function createKnowledge(docs, points) {
function normalize(text) {
  return text
    .toLowerCase()
    .replace(/([a-z]+)[ -]+(\d+)/g, "$1$2")
    .replace(/[?？!.,]/g, " ");
}
function retrieve(question, limit = 4) {
  const q = normalize(question);
  const terms = q.split(/\s+/).filter((t) => t.length > 1);
  const mentions = points.filter((p) =>
    [p.id.toLowerCase(), p.name, p.hanja, p.pinyin.toLowerCase()].some((t) =>
      t.match(/^[a-z]+\d+$/)
        ? new RegExp(`\\b${t}\\b`, "i").test(q)
        : q.includes(t),
    ),
  );
  // Explicit point mentions win, including Korean particles attached to a name.
  const scored = docs
    .map((d) => {
      let score = 0;
      const title = normalize(d.title);
      const body = normalize(d.body);
      if (d.pointId && mentions.some((p) => p.id === d.pointId)) score += 100;
      for (const term of terms) {
        if (title.includes(term)) score += 10;
        else if (body.includes(term)) score += 1;
      }
      if (
        d.id === "point-categories" &&
        /원혈|모혈|오수혈|낙혈|장부|분류/.test(q)
      )
        score += 120;
      if (d.id === "massage-anatomy" && /마사지|지압|압박|압력/.test(q))
        score += 130;
      if (d.id === "layer-guide" && /장기|혈관|신경|레이어|단계|절개/.test(q))
        score += 40;
      if (d.id === "cun" && /b.?cun|f.?cun|분촌|골도|寸/.test(q)) score += 40;
      if (d.id === "evidence" && /효과|근거|치료|안전|통증|질환|임상/.test(q))
        score += 30;
      if (
        d.id === "library-comparison" &&
        /라이브러리|three|babylon|vtk|기술|llm/.test(q)
      )
        score += 30;
      if (d.id === "coordinate-method" && /좌표|정확|검수|투영/.test(q))
        score += 30;
      if (d.id === "licenses" && /라이선스|license|저작|재배포/.test(q))
        score += 30;
      return { doc: d, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return scored.map((x) => x.doc);
}
function fallback(question, retrieved = retrieve(question)) {
  if (
    /(장기|내장|간을|간에|위장|심장|콩팥).*(마사지|누르|압박|압력|지압)|(마사지|지압|누르).*(장기|내장)/.test(
      normalize(question),
    )
  )
    return {
      mode: "scope",
      message:
        "체표 경혈을 눌러 내부 장기를 직접 마사지하거나 치료하는 방법은 안내하지 않습니다. 장부 대응은 전통적 분류이며 압력 전달 경로가 아닙니다. 단계별 모델에서 위치 관계를 비교하고 마사지 근거와 주의사항을 확인하세요.",
      documents: [
        {
          id: "massage-anatomy",
          title: "경혈 마사지와 내부 장기 — 해부학 참고 가이드",
        },
        { id: "layer-guide", title: "단계별 해부 탐색 사용법" },
      ],
    };
  if (
    /자침|찌르|찌를|시술.*(방법|각도|깊이)|needle.*depth|insert.*needle|처방/.test(
      normalize(question),
    )
  )
    return {
      mode: "scope",
      message:
        "이 위키는 해부학과 경혈 위치의 학습 자료입니다. 자침 방법이나 개인별 처방을 안내하지 않습니다. 안전과 근거 문서를 확인해 주세요.",
      documents: [
        { id: "evidence", title: "위치 표준과 치료 근거는 다릅니다" },
      ],
    };
  if (!retrieved.length)
    return {
      mode: "no-evidence",
      message:
        "수록된 위키에서 질문을 뒷받침할 자료를 찾지 못했습니다. 경혈 이름·코드 또는 골도분촌, 좌표, 라이선스로 질문해 보세요.",
      documents: [],
    };
  return {
    mode: "retrieval",
    message:
      "질문과 관련된 위키 문서를 찾았습니다. 아래 요약과 연결 문서에서 출처를 확인하세요.",
    answer: retrieved.slice(0, 3).map((d) => ({
      text: d.pointId
        ? `${d.title}: ${points.find((p) => p.id === d.pointId).location} 지도 좌표는 전문가 미검수 학습용 근사입니다.`
        : d.body
            .split("\n\n")
            .filter((p) => !p.startsWith("#") && !p.startsWith("|"))[0]
            .replace(/\*\*/g, ""),
      citations: [d.id],
    })),
    documents: retrieved.map((d) => ({ id: d.id, title: d.title })),
  };
}

return { retrieve, fallback };
}
