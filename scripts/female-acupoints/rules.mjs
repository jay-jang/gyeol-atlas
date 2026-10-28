// Frontal-plane targets of the female acupoint rules
// (data/female-acupoint-rules.json) from the measured landmarks
// (data/female-acupoint-landmarks.json, "female" block).

/** x of the anterior median line at level y (linear between the 5 mm samples, held at the ends). */
export function medianX(L, y) {
  const s = L.anteriorMedianLine.samplesYXRmsMm;
  if (y <= s[0][0]) return s[0][1];
  for (let i = 1; i < s.length; i++) if (y <= s[i][0]) return s[i - 1][1] + ((s[i][1] - s[i - 1][1]) * (y - s[i - 1][0])) / (s[i][0] - s[i - 1][0]);
  return s[s.length - 1][1];
}
export function scales(L) {
  const yN = L.navel.point[1];
  return {
    upper: (L.xiphisternalJunction.point[1] - yN) / 8,
    lower: (yN - L.pubicSymphysisSuperior.point[1]) / 5,
    lateral: (L.nipples.left[0] - L.nipples.right[0]) / 8,
  };
}
const LEVEL = {
  navel: (L) => L.navel.point[1], xiphisternalJunction: (L) => L.xiphisternalJunction.point[1],
  pubicSymphysisSuperior: (L) => L.pubicSymphysisSuperior.point[1], pubicSymphysisInferior: (L) => L.pubicSymphysisInferior.point[1],
};
const SIGN = { right: -1, left: 1 };
/** Height (y) a rule's vertical part sets. */
export function ruleLevel(rule, L) {
  const v = rule.vertical;
  return LEVEL[v.from](L) + v.cun * (v.scale ? scales(L)[v.scale] : 0);
}
/** side: "right" (-x), "left" (+x) or "midline". Returns the frontal target { x, y } in metres. */
export function ruleTarget(rule, L, side) {
  const S = scales(L), sign = SIGN[side] ?? 0;
  if (rule.construction?.type === "lineAtLevel") {
    // Frontal-plane intersection of the line between two per-side landmarks with a horizontal level.
    const c = rule.construction, a = L[c.line[0]][side], b = L[c.line[1]][side], y = LEVEL[c.level](L), t = (a[1] - y) / (a[1] - b[1]);
    return { x: a[0] + t * (b[0] - a[0]), y };
  }
  if (rule.construction) throw Error(`${rule.id}: ${rule.construction.type} is not a frontal target`);
  const v = rule.vertical;
  let y = LEVEL[v.from](L) + v.cun * (v.scale ? S[v.scale] : 0), x;
  if (rule.lateral.from === "navel") x = L.navel.point[0];
  else if (rule.lateral.from === "asis") x = L.asis[side][0] + sign * rule.lateral.cun * S.lateral;
  else if (rule.lateral.from === "anteriorMedianLine") {
    if (rule.lateral.cun && !sign) throw Error(`${rule.id}: a lateral rule needs a side`);
    x = medianX(L, y) + sign * rule.lateral.cun * S.lateral;
  } else throw Error(`${rule.id}: lateral from ${rule.lateral.from} has no frontal target`);
  if (rule.offset) {
    // "medioinferior" by rule.offset.cun at angleDeg below the horizontal: lateral B-cun across, the named vertical scale down.
    const o = rule.offset, a = (o.angleDeg * Math.PI) / 180;
    x -= sign * o.cun * Math.cos(a) * S.lateral;
    y -= o.cun * Math.sin(a) * S[o.verticalScale];
  }
  return { x, y };
}
