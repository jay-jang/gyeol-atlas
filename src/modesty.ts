// "성기 가리기" (on by default since 2026-10-26): leave the external genital
// structures out of every system, and draw the male skin closed over the groin
// (src/modesty-skin.ts). A display preference only; search still finds every
// structure, and a structure chosen explicitly (or the organ detail that holds
// it) is shown.
const GENITAL_IDS = new Set([
  // BodyParts3D male: glans, corpus spongiosum, corpus cavernosum, testes,
  // epididymides, the deferent ducts that run down into the scrotum and the
  // urethra (one mesh, its penile part included)
  "FMA18247", "FMA19617nsn", "FMA19618", "FMA7211", "FMA7212", "FMA18256", "FMA18257", "FMA19235", "FMA19236", "FMA19667",
  // HRA female: vagina
  "HRAF0406",
]);
// Word-bounded female terms: "labial" lip vessels and the lips themselves are
// not genital (HRA has no vulva, clitoris or labia meshes; these guard sources).
const GENITAL_NAME = /penis|penile|scrot|testi(s|cular)|glans|epididym|deferen|spermatic|cremaster|\bclitor|\blabi(a|um)\b|\bvulv/i;
// Vessels and the nerve branch that follow the male external genitalia out of
// the body: with the genitals gone they would still trace their outline. The
// same list the female transport leaves out ("male external genital course",
// scripts/female-transport/selection.py).
const GENITAL_COURSE = /^(Superficial external pudendal artery|Deep external pudendal artery|External pudendal veins|Genital branch of genitofemoral nerve)/i;
// Acupoints whose male markers the closed skin carries centimetres forward onto
// its editorial surface (data/modesty-male-skin.json "anchors"); their card
// says so (tests/modesty-skin.test.mjs keeps the two in step).
export const MODEST_MOVED_POINTS = ["LR10", "LR11"];
export const isGenitalStructure = (id: string, name = "") => GENITAL_IDS.has(id) || GENITAL_NAME.test(name) || GENITAL_COURSE.test(name);
// Whether a mesh is left out: hidden genitals, unless the viewer chose it (a
// search result, a structure link) or opened an organ detail that holds it.
export const hidesGenital = (modesty: boolean, id: string, name: string | undefined, revealed: boolean) =>
  modesty && !revealed && isGenitalStructure(id, name);
