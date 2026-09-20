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

## NIH Human Reference Atlas female reference

The female cardiovascular, digestive, integumentary, lymphatic, renal, reproductive and skeletal reference layers derive from the **NIH Human Reference Atlas (HRA) 3D Reference Organ Library**, based on the Visible Human Female dataset of the U.S. National Library of Medicine. They are licensed under **CC BY 4.0**.

- Source release: https://cdn.humanatlas.io/digital-objects/ref-organ/united-female/v1.5/
- Human Reference Atlas: https://humanatlas.io/
- License: https://creativecommons.org/licenses/by/4.0/
- Packaging source: https://github.com/Nurkan1/Anatria-3D
- Pinned source commit, exact asset URLs and SHA-256 hashes: `data/catalog/sex-lymph-models.json`

The legacy 264-part GLB exports remain attributed but are no longer rendered in female mode. The previous male whole-body overlay has been removed from female rendering.

### Independent packed female atlas and male organ details

`public/models/female/` and `public/models/male-detail/` are adapted from [slorksmo/Human-Atlas](https://github.com/slorksmo/Human-Atlas/tree/5bb5713aab18d7fe9380c3339eb09f173491ea06), pinned commit `5bb5713aab18d7fe9380c3339eb09f173491ea06`. The upstream full attribution is preserved in `public/models/female/ATTRIBUTION.md`; its descriptions of upstream defaults do not describe GYEOL's defaults.

- Female native anatomy: Kristen Browne and Heidi Schlehlein, Human Reference Atlas / HuBMAP, *3D Reference Organ Set for Female*, v1.10, plus eight pelvic structures from v1.5. CC BY 4.0, based on the NLM Visible Human Dataset. [Reference library](https://humanatlas.io/3d-reference-library).
- Female donor lower-limb muscles: Thor E. Andreassen et al., *Three Dimensional Lower Extremity Musculoskeletal Geometry of the Visible Human Female and Male*, Scientific Data 10, 34 (2023), [doi:10.1038/s41597-022-01905-2](https://doi.org/10.1038/s41597-022-01905-2), CC BY 4.0. A separate donor, not the HRA body's own muscles.
- 180 male-derived supplementary bones and 423 male organ-detail meshes: **BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International**. BodyParts3D 4.0, `isa_BP3D_4.0_obj_99.zip`. [Current license](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Upstream adaptations include coordinate conversion, transform baking, mesh simplification, quantized normals, and documented regional fitting of donor muscle and borrowed bones. GYEOL preserves the female geometry and its coordinates, assigns display layers, links the exact source organ memberships, hides pregnancy references unless selected, suppresses overlapping donor rectus muscles by default, and labels borrowed bones in a distinct grey color. GYEOL enables donor muscles and borrowed bones in their corresponding layers. No male organs are added to the female body. Female stomach, upper-body muscles and some peripheral nerves are absent; female acupoint coordinates are unvalidated and hidden. This is not a complete or clinically registered atlas.

Male details are repacked without modifying their source vertices and displayed independently, never superimposed on the differently sourced male overview. Source and local hashes are recorded in `data/catalog/female-atlas-source.json` and `data/catalog/male-detail-source.json`. Source anatomical English and identifiers are retained; Korean grouping is editorial and not expert-validated.

The male Z-Anatomy overview overlay uses one uniform scale/translation fitted to four named neural centers; the measurements and 39 held-out vascular center differences are recorded in `data/catalog/male-registration.json`. Peeling does not change this transform. Residual local differences remain; this is not anatomical or clinical validation.

## Independent female CT detail supplement

**Jakob Wasserthal, University Hospital Basel**, *Dataset with segmentations of 117 important anatomical structures in 1228 CT images*, version 2.0.1, [DOI 10.5281/zenodo.10047292](https://zenodo.org/records/10047292), licensed **CC BY 4.0**. [License](https://creativecommons.org/licenses/by/4.0/). Citation: Wasserthal et al., *TotalSegmentator: Robust Segmentation of 104 Anatomic Structures in CT Images*, Radiology: Artificial Intelligence 5(5), e230024 (2023), [DOI](https://doi.org/10.1148/ryai.230024).

The published metadata records subject s0255 as female. Eleven binary masks are preserved in `data/female-ct/s0255/`, including stomach, adrenal glands, esophagus, back musculature, liver, spleen, kidneys and pancreas. The esophagus and back musculature are limited by the CT field of view; they are not complete organ/muscle-length reconstructions. The material is not a complete healthy-female population atlas.

GYEOL adaptations: Lewiner marching cubes at level 0.5 on the published masks (no new segmentation); RAS millimeters converted to left/superior/anterior meters; one common translation for display; calculated and quantized normals, packed geometry and gzip, editorial colors and Korean labels. No shape warping, HRA fitting or male substitution is applied. All eleven CT parts retain their mutual source positions in an independent detail scene. The rejected cross-donor fit, CRC32 checks and SHA-256 hashes are recorded in `data/catalog/female-detail-source.json`. No claim of clinical validation or endorsement is made. The public notice travels with the site at `public/models/LICENSE_female_ct.txt`.

The earlier statement that the HRA whole-body source lacks a stomach remains true for that source; the independent CT detail now supplies a stomach reference, not a replacement inside HRA's body.

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
