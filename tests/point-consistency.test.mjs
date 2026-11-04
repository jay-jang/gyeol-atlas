import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { organClassPoints, organKeyPointIds, organScopes, organsOfView, organChoices, organLabel, luoNote, pointTermsMatch } from '../src/point-display.ts';
import { rankPoints } from '../src/search-rank.ts';
import { initialView, viewReducer, restoreView } from '../src/view-state.ts';
const read = name => JSON.parse(fs.readFileSync(`data/${name}.json`));
const points = read('points');
const ids = list => list.map(p => p.id);

test('every zang-fu lists its own source, front-mu, back-shu, xi-cleft, connecting and five-shu points', () => {
  const lung = Object.fromEntries(organClassPoints('LU', points).map(g => [g.concept.id, ids(g.points)]));
  assert.deepEqual(lung, { yuan: ['LU9'], mu: ['LU1'], 'back-shu': ['BL13'], xi: ['LU6'], luo: ['LU7'], 'five-shu': ['LU11', 'LU10', 'LU9', 'LU8', 'LU5'] });
  assert.deepEqual(organKeyPointIds('LU', points), ['LU9', 'LU1', 'BL13', 'LU6', 'LU7']);
  for (const { id } of organChoices) {
    const groups = Object.fromEntries(organClassPoints(id, points).map(g => [g.concept.id, ids(g.points)]));
    for (const c of ['yuan', 'mu', 'back-shu', 'xi']) assert.equal(groups[c]?.length, 1, `${id} ${c}`);
    // The spleen's great connecting point SP21 is a second connecting point on its channel.
    assert.equal(groups.luo.length, id === 'SP' ? 2 : 1, `${id} luo`);
    assert.equal(groups['five-shu'].length, 5, `${id} five-shu`);
  }
  // Extra-vessel xi points stay with their vessel, not the channel's zang-fu.
  assert.deepEqual(ids(organClassPoints('KI', points).find(g => g.concept.id === 'xi').points), ['KI5']);
  assert.deepEqual(ids(organClassPoints('BL', points).find(g => g.concept.id === 'xi').points), ['BL63']);
  assert.deepEqual(ids(organClassPoints('GB', points).find(g => g.concept.id === 'xi').points), ['GB36']);
  // Assigned Mu/Back-Shu points are listed under their zang-fu, not under the channel they lie on.
  assert.deepEqual(ids(organClassPoints('PC', points).find(g => g.concept.id === 'mu').points), ['CV17']);
  assert.equal(organClassPoints('BL', points).find(g => g.concept.id === 'back-shu').points.map(p => p.id).join(), 'BL28');
  assert.deepEqual(organClassPoints('CV', points), []);
});

const male = read('male-organ-groups'), maleDetail = read('male-detail-groups');
const female = [...read('female-organ-groups'), ...read('female-transport-groups'), ...read('female-biliary-groups'), ...read('female-detail-groups')];
// As src/anatomy.ts organGroups: a male detail group replaces its overview group.
const groups = [...male.map(g => maleDetail.find(d => d.id === g.id) || g), ...female];
const structures = [...male, ...maleDetail, ...female].flatMap(g => g.ids.map(id => ({ id, group: g.id })));
const view = (sex, ids, scope = {}) => organsOfView(organScopes(sex, structures, groups), groups, sex, ids, scope);
test('an anatomical organ view maps to the zang-fu whose traditional comparison uses the same meshes', () => {
  const detail = (sex, id) => view(sex, groups.find(g => g.sex === sex && g.id === id)?.ids ?? [], { detailId: id });
  assert.deepEqual(detail('male', 'lung'), ['LU']);
  assert.deepEqual(detail('male', 'stomach'), ['ST']);
  assert.deepEqual(detail('male', 'heart'), ['HT']);
  assert.deepEqual(detail('male', 'liver'), ['LR']);
  assert.deepEqual(detail('male', 'kidney'), ['KI']);
  assert.deepEqual(detail('male', 'spleen'), ['SP']);
  assert.deepEqual(detail('male', 'bladder'), ['BL']);
  for (const id of ['brain', 'pancreas']) assert.deepEqual(detail('male', id), [], id);
  assert.deepEqual(detail('female', 'lung'), ['LU']);
  assert.deepEqual(detail('female', 'intestine'), ['LI', 'SI']);
  assert.deepEqual(detail('female', 'gallbladder'), ['GB']);
  assert.deepEqual(detail('female', 'stomach'), ['ST']);
  assert.deepEqual(detail('female', 'stomach-ct'), ['ST']);
  for (const id of ['uterus', 'ovary', 'breast', 'pancreas', 'abdomen-ct']) assert.deepEqual(detail('female', id), [], id);
  // A single mesh maps through the comparison meshes themselves, else through
  // its organ group when that group is one organ concept.
  assert.deepEqual(view('male', ['FMA7333']), ['LU']);
  assert.deepEqual(view('male', ['FMA7088'], { pickedGroup: 'heart' }), ['HT'], 'the whole heart as well as its wall');
  assert.deepEqual(view('male', ['FMA14543nsn']), ['LI']);
  assert.deepEqual(view('male', ['FMA7202']), ['GB']);
  assert.deepEqual(view('female', ['HRAF0519'], { pickedGroup: 'intestine' }), ['LI'], 'a colon part is the large intestine alone');
  assert.deepEqual(view('female', ['HRAF0512'], { pickedGroup: 'intestine' }), ['SI']);
  assert.deepEqual(view('female', ['HRAF_RECTUM'], { pickedGroup: 'intestine' }), [], 'a part of the two-concept intestine group outside the comparison maps to nothing');
  assert.deepEqual(view('female', ['HRAF0687'], { pickedGroup: 'gallbladder' }), ['GB'], 'the gallbladder comparison is its whole bundle (Q33)');
  assert.deepEqual(view('male', ['FMA24474']), []);
  assert.deepEqual(view('female', ['CTF_stomach', 'CTF_esophagus'], { detailId: 'abdomen-ct' }), [], 'a CT bundle is not one zang-fu');
  // One part picked inside a detail: its own FMA id, else a single-concept group.
  assert.deepEqual(view('male', ['BP4_FJ2564'], { pickedGroup: 'stomach', fmaIds: ['FMA7148'] }), ['ST'], 'the 4.0 stomach itself');
  assert.deepEqual(view('male', ['BP4_FJ3499'], { pickedGroup: 'stomach', fmaIds: ['FMA14768'] }), [], 'a gastric artery is not 위');
  assert.deepEqual(view('male', ['BP4_FJ3144'], { pickedGroup: 'kidney', fmaIds: ['FMA9704'] }), [], 'a ureter is not 신');
  assert.deepEqual(view('male', ['BP4_FJ5951'], { pickedGroup: 'lung' }), ['LU'], 'right and left lung are one organ concept');
  // The pericardium and triple burner are never replaced by one anatomical organ.
  for (const sex of ['male', 'female']) assert.equal(organScopes(sex, structures, groups).some(s => ['PC', 'TE'].includes(s.organ)), false);
});

test('changing any acupoint filter draws its result, whichever marker mode hid it', () => {
  for (const markers of ['hidden', 'selected']) {
    const s = { ...initialView('ST36'), markers };
    assert.equal(viewReducer(s, { type: 'filters', value: { concept: 'yuan' } }).markers, 'filtered', markers);
    assert.equal(viewReducer(s, { type: 'filters', value: { query: '폐' } }).markers, 'filtered', markers);
    assert.equal(viewReducer(s, { type: 'reset-filters' }).markers, 'filtered', markers);
  }
  const s = { ...initialView('ST36'), camera: { position: [0, 1, 2], target: [0, 1, 0] }, labels: true, markerColor: 'organ' };
  const next = viewReducer(s, { type: 'filters', value: { organ: 'LU' } });
  assert.deepEqual([next.camera, next.labels, next.markerColor, next.pointId], [s.camera, true, 'organ', 'ST36']);
});

test('a chosen acupoint is always drawn and can be deselected without losing the scene', () => {
  const hidden = { ...initialView('ST36'), markers: 'hidden' };
  assert.equal(viewReducer(hidden, { type: 'point', id: 'LU9' }).markers, 'selected');
  assert.equal(viewReducer(hidden, { type: 'point', id: 'ST36' }).markers, 'selected', 'picking the same point again shows it');
  assert.equal(viewReducer({ ...hidden, markers: 'filtered' }, { type: 'point', id: 'LU9' }).markers, 'filtered');
  const studied = viewReducer({ ...initialView('ST36'), filters: { ...initialView().filters, organ: 'LU' } }, {
    type: 'select', layer: 'organ', selection: { kind: 'structure', ids: ['FMA7333'], name: '오른폐 상엽', layers: ['organ'] },
  });
  const cleared = viewReducer(studied, { type: 'clear-point' });
  assert.equal(cleared.pointId, '');
  assert.deepEqual([cleared.selection, cleared.filters, cleared.markers, cleared.camera], [studied.selection, studied.filters, studied.markers, studied.camera]);
  assert.equal(viewReducer(cleared, { type: 'clear-point' }), cleared);
  const compared = viewReducer(initialView('LU9'), { type: 'compare', name: '폐', ids: ['FMA7333'], selectionLayers: ['organ'] });
  const left = viewReducer(compared, { type: 'clear-point' });
  assert.deepEqual([left.pointId, left.comparison, left.selection], ['', null, null], 'the comparison belonged to the point');
  assert.equal(restoreView(JSON.stringify(cleared), points.map(p => p.id), structures.map(s => ({ ...s, layer: 'organ' }))).pointId, '');
});

test('showing a zang-fu on the body applies only its organ filter and returns from a detail source', () => {
  const s0 = { ...initialView('ST36'), markers: 'hidden', filters: { ...initialView().filters, concept: 'xi', meridian: 'ST', query: '족' } };
  const detail = viewReducer(s0, { type: 'detail', detail: { id: 'lung', name: '폐', ids: ['BP4_FJ5951'], layers: { skin: false, muscle: false, bone: false, organ: true, vessel: false, lymph: false, nerve: false } } });
  const shown = viewReducer(detail, { type: 'organ-points', organ: 'LU' });
  assert.deepEqual(shown.filters, { ...initialView().filters, organ: 'LU' });
  assert.deepEqual([shown.markers, shown.detail, shown.selection, shown.isolated, shown.pointId], ['filtered', null, null, false, 'ST36']);
  assert.deepEqual([shown.displayMode, shown.dissection, shown.layers], [s0.displayMode, s0.dissection, s0.layers], 'the scene the detail replaced returns');
  const picked = viewReducer({ ...initialView(), isolated: true, selection: { kind: 'structure', ids: ['FMA7333'], name: '오른폐 상엽', layers: ['organ'] } }, { type: 'organ-points', organ: 'LU' });
  assert.deepEqual([picked.selection.ids, picked.isolated, picked.filters.organ], [['FMA7333'], false, 'LU'], 'a body selection stays while its zang-fu points are drawn');
  const plain = initialView();
  for (const organ of ['XX', 'CV', 'all']) assert.equal(viewReducer(plain, { type: 'organ-points', organ }), plain, organ);
});

test('a filter change ends isolation, and the region chips and the body region never contradict', () => {
  const picked = viewReducer(initialView('ST36'), { type: 'select', layer: 'organ', selection: { kind: 'structure', ids: ['FMA7148'], name: '위', layers: ['organ'] } });
  const isolated = viewReducer(picked, { type: 'isolate' });
  assert.equal(isolated.isolated, true);
  const filtered = viewReducer(isolated, { type: 'filters', value: { meridian: 'ST' } });
  assert.deepEqual([filtered.isolated, filtered.selection, filtered.markers], [false, isolated.selection, 'filtered']);
  let s = viewReducer(initialView(), { type: 'region-filter', value: '가슴' });
  s = viewReducer(s, { type: 'filters', value: { region: '다리·발' } });
  assert.deepEqual([s.filters.region, s.filters.bodyRegion], ['다리·발', '전체']);
  s = viewReducer(s, { type: 'filters', value: { bodyRegion: '목' } });
  assert.deepEqual([s.filters.region, s.filters.bodyRegion], ['전체', '목']);
  assert.deepEqual(viewReducer(s, { type: 'filters', value: { concept: 'yuan' } }).filters.bodyRegion, '목');
  assert.equal(viewReducer(isolated, { type: 'reset-filters' }).isolated, false, '초기화 ends isolation too');
});

test("picking the chosen point again keeps the comparison that belongs to it", () => {
  const compared = viewReducer(initialView('LU9'), { type: 'compare', name: '폐', ids: ['FMA7333'], selectionLayers: ['organ'] });
  assert.equal(viewReducer(compared, { type: 'point', id: 'LU9' }), compared);
  assert.equal(viewReducer(compared, { type: 'point', id: 'LU1' }).comparison, null, 'another point still ends it');
});

test('both searches also find points by class and by related zang-fu, after name and code hits', () => {
  const meridians = read('meridians');
  const rank = q => rankPoints(points, q, p => meridians.find(m => m.id === p.meridian)?.name, pointTermsMatch).map(p => p.id);
  assert.deepEqual([...rank('원혈')].sort(), 'BL64 GB40 HT7 KI3 LI4 LR3 LU9 PC7 SI4 SP3 ST42 TE4'.split(' ').sort());
  assert.equal(rank('原穴').length, 12);
  assert.equal(rank('락혈').length, 15);
  assert.ok(rank('대장').includes('ST25'), 'the large intestine mu point');
  assert.ok(rank('위').includes('CV12'), 'the stomach mu point');
  assert.ok(rank('음교맥').includes('KI8'), 'an extra-vessel xi point by its vessel');
  assert.equal(rank('ST36')[0], 'ST36');
  // 수혈(輸穴) is the five-shu stream point only, never 배수혈 or every 오수혈.
  assert.deepEqual([...rank('수혈')].sort(), 'LU9 LI3 ST43 SP3 HT7 SI3 BL65 KI3 PC7 TE3 GB41 LR3'.split(' ').sort());
  assert.deepEqual([...rank('輸穴')].sort(), [...rank('수혈')].sort());
  assert.equal(rank('배수혈').length, 12);
  assert.ok(!rank('심').includes('CV17') && rank('심').includes('CV14'), '심 is not 심포');
  assert.ok(rank('원').includes('KI3'), 'a class word typed partly');
  assert.deepEqual(rank('혈'), rankPoints(points, '혈', p => meridians.find(m => m.id === p.meridian)?.name).map(p => p.id), '혈 alone is not a class word');
  assert.equal(organLabel('KI'), '신(腎)'); assert.equal(organLabel('LU'), '폐');
  assert.equal(luoNote('SP21'), '비의 대락'); assert.equal(luoNote('SP4'), '');
});
