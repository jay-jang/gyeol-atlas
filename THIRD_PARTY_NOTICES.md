# Attribution and content licenses

## BodyParts3D models and derivatives

**BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan**.

- Original project: https://lifesciencedb.jp/bp3d/
- License: https://creativecommons.org/licenses/by-sa/2.1/jp/
- Legal text: https://creativecommons.org/licenses/by-sa/2.1/jp/legalcode
- Paper: Mitsuhashi et al., _BodyParts3D: 3D structure database for anatomical concepts_, Nucleic Acids Research 37, D782–D785 (2009). https://doi.org/10.1093/nar/gkn613
- Data archive: https://doi.org/10.18908/lsdba.nbdc00837-000
- STL conversion/mirror: Kevin Mattheus Moerman, https://github.com/Kevin-Mattheus-Moerman/BodyParts3D
- Pinned commit: `f0eeb6e843380cfe6b83797cf8c3e1af74de5e61`
- Supplement: 249 OBJ elements from the official Anatomography 4.3 exporter. Version membership is pinned in `data/catalog/v43-FMA2Obj.txt`; export requests in `data/catalog/v43-supplement.json`; per-file FMA identity, original name and source SHA-256 in `public/models/manifest.json`. Elements use source millimetres and the same axis transform; this is not anatomical registration between dataset versions. The [official version notes](https://lifesciencedb.jp/bp3d/info_en/index.html) state that major versions can differ in body coordinates. Source OBJ headers were used instead of the cross-version lookup names.
- Original dataset: v3.0 / 20110915, OBJ 95 archive converted to STL by the mirror author.

`public/models/*.glb`, their rendered images, and model-derived coordinate fields in `data/points.json` and distributed copies are provided under **CC BY-SA 2.1 Japan**. Preserve attribution, link to the license, disclose modifications, and use the same license for adapted model material. The source notice is preserved in `public/models/LICENSE_content.txt`.

GYEOL modifications: STL/OBJ parsing, positional welding, meshoptimizer topology-aware simplification (maximum requested relative error 0.003), recalculated normals, common coordinate transformation, binary GLB export. Original assets and checksums, observed simplification errors and resulting triangle counts are recorded in `public/models/manifest.json`. No clinical registration or expert validation was performed. Appearance, scale and surface details may differ from the original. These derivatives do not imply endorsement by DBCLS or the mirror author.

## Z-Anatomy whole-body system supplement

The whole-body nervous and cardiovascular reference layers are adapted from **Z-Anatomy — the libre 3D atlas of anatomy**, licensed under **CC BY-SA 4.0**, and ultimately derive in part from BodyParts3D. The web-ready system exports were produced by the open Anatria-3D asset pipeline.

- Z-Anatomy source and attribution: https://github.com/Z-Anatomy/Models-of-human-anatomy
- Packaging source: https://github.com/Nurkan1/Anatria-3D
- License: https://creativecommons.org/licenses/by-sa/4.0/
- Exact source URLs, hashes, component counts and measured bounds: `data/catalog/full-system-supplement.json`

GYEOL modification: the two system exports are loaded as non-diagnostic whole-body reference overlays alongside the individually searchable BodyParts3D structures. Materials are replaced at runtime to match the GYEOL layer legend. The geometry is not clinically registered and may have local alignment differences even though its measured whole-body bounds match the BodyParts3D scene coordinate range.

## WHO and clinical sources

WHO documents and NCCIH web pages retain their respective original rights. The repository includes short independently written educational summaries, citations, and metadata; it does **not** redistribute the WHO books or diagrams and does not claim that they are open-licensed. WHO did not supply or validate the 3D acupoint coordinates. Korean summaries are AI drafts, not official WHO translations.

## Original wiki prose

Original GYEOL prose in `wiki/`, plus its generated copies, is offered under **CC BY 4.0** (https://creativecommons.org/licenses/by/4.0/), attributed to GYEOL contributors. TCM Wiki-derived sections are excluded from this CC BY 4.0 grant and remain CC BY-SA 4.0 as described below. This grant applies only to original contributions, not to third-party references, model-derived coordinate data, or embedded images of the model. Model-derived material retains the license above.

## Software dependencies

Application source is MIT. Dependency licenses remain their own: React, Three.js, React Three Fiber, Drei, meshoptimizer, glTF Transform, Vite, Express, React Markdown, remark-gfm and the other installed dependencies include license files in their npm packages. Lucide icons use ISC. Playwright uses Apache 2.0. Exact installed versions are locked in `package-lock.json`.

The font stylesheet loads DM Sans and Noto Sans KR via Google Fonts. Text falls back to locally installed sans-serif fonts if unavailable. Their original font licenses apply; no font binaries are bundled here.

## Acupoint catalogue and traditional indications

KMCRIC (https://www.kmcric.com/database/acupoint) supplies the factual 361 + 48 catalogue and short location excerpts. Its original rights remain reserved; per-point links and editorial limitations are recorded in data/acupoint-content.json. No full source books or pages are redistributed.

Traditional indication excerpts and Korean adaptations attributed to TCM Wiki are licensed CC BY-SA 4.0 (https://tcmwiki.com/wiki/copyrights; https://creativecommons.org/licenses/by-sa/4.0/). These sections in data/acupoint-content.json, data/points.json and generated wiki copies retain that license. Changes: selected historical indications, shortened Korean paraphrases, and explicit separation from clinical efficacy. Each record retains its source URL and license. EX-UE6 uses a short independently written eLotus summary with its own source attribution, not the TCM Wiki license. The original five-phase explanatory prose cites the physician-authored Five Shu table.
