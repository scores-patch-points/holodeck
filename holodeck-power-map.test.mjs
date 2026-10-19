import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGraph, addEntity, addRelation, removeEntity, removeRelation, mergeGraph,
  entityByName, idOf, findEntity, findRelation, adjacency,
  findCycle, isDag, topoOrder, enforceDag,
  layerGraph, layoutGraph, toSvg,
  fromLittleSis, fromTies, toJSON, fromJSON, graphStats,
} from './holodeck-power-map.js';

const g3 = () => {
  let g = createGraph();
  g = addEntity(g, { name: 'Jane Roe', kind: 'person' }).graph;
  g = addEntity(g, { name: 'Acme PAC', kind: 'org' }).graph;
  g = addEntity(g, { name: 'Acme Holdings', kind: 'org' }).graph;
  g = addRelation(g, { from: idOf(g, 'Jane Roe'), to: idOf(g, 'Acme PAC'), category: 'donation' });
  g = addRelation(g, { from: idOf(g, 'Acme PAC'), to: idOf(g, 'Acme Holdings'), category: 'ownership' });
  return g;
};

test('entities are added once by name; ids are stable', () => {
  let g = createGraph();
  const a = addEntity(g, { name: 'Jane Roe', kind: 'person' }); g = a.graph;
  const b = addEntity(g, { name: '  jane   roe ', kind: 'org' }); g = b.graph;
  assert.equal(a.existing, false);
  assert.equal(b.existing, true);
  assert.equal(b.id, a.id);
  assert.equal(g.entities.length, 1);
  assert.equal(findEntity(g, a.id).kind, 'person', 'the first kind stands');
  assert.equal(entityByName(g, 'JANE ROE').id, a.id);
});

test('a relation needs both ends and refuses a self-loop', () => {
  let g = createGraph();
  g = addEntity(g, { name: 'A' }).graph;
  const a = idOf(g, 'A');
  assert.equal(addRelation(g, { from: a, to: 'missing', category: 'tie' }).relations.length, 0);
  assert.equal(addRelation(g, { from: a, to: a, category: 'tie' }).relations.length, 0);
  g = addEntity(g, { name: 'B' }).graph;
  const g2 = addRelation(g, { from: a, to: idOf(g, 'B'), category: 'tie' });
  assert.equal(g2.relations.length, 1);
});

test('the same relation twice is one relation', () => {
  let g = g3();
  const from = idOf(g, 'Jane Roe'), to = idOf(g, 'Acme PAC');
  const g2 = addRelation(g, { from, to, category: 'donation' });
  assert.equal(g2.relations.length, g.relations.length);
});

test('removing an entity removes every relation that touches it', () => {
  const g = g3();
  const g2 = removeEntity(g, idOf(g, 'Acme PAC'));
  assert.equal(g2.entities.length, 2);
  assert.equal(g2.relations.length, 0, 'both relations used Acme PAC');
});

test('a chain is a DAG; a back edge is a cycle', () => {
  let g = g3();
  assert.equal(isDag(g), true);
  assert.equal(findCycle(g), null);
  assert.deepEqual(topoOrder(g), g.entities.map((e) => e.id).sort((a, b) => g.entities.findIndex((x) => x.id === a) - g.entities.findIndex((x) => x.id === b)));

  g = addRelation(g, { from: idOf(g, 'Acme Holdings'), to: idOf(g, 'Jane Roe'), category: 'membership' });
  const cyc = findCycle(g);
  assert.ok(cyc && cyc.length >= 4, 'cycle closes back on itself');
  assert.equal(cyc[0], cyc[cyc.length - 1], 'the repeated id names the loop');
  assert.equal(isDag(g), false);
  assert.equal(topoOrder(g), null);
});

test('enforceDag breaks a cycle by dropping the least load-bearing relation', () => {
  let g = g3();
  g = addRelation(g, { from: idOf(g, 'Acme Holdings'), to: idOf(g, 'Jane Roe'), category: 'tie', derived: true, undirected: true });
  const { graph, removed, wasDag } = enforceDag(g);
  assert.equal(wasDag, false);
  assert.equal(removed.length, 1);
  assert.equal(removed[0].derived, true, 'the derived tie goes before an asserted relation');
  assert.equal(isDag(graph), true);
  assert.equal(graph.relations.length, g.relations.length - 1);
});

test('enforceDag leaves an acyclic graph untouched', () => {
  const g = g3();
  const r = enforceDag(g);
  assert.equal(r.wasDag, true);
  assert.equal(r.removed.length, 0);
  assert.equal(r.graph.relations.length, g.relations.length);
});

test('layers: a source is rank 0, each entity one below its deepest parent', () => {
  const g = g3();
  const { rank, layers } = layerGraph(g);
  assert.equal(rank.get(idOf(g, 'Jane Roe')), 0);
  assert.equal(rank.get(idOf(g, 'Acme PAC')), 1);
  assert.equal(rank.get(idOf(g, 'Acme Holdings')), 2);
  assert.equal(layers.length, 3);
});

test('layout positions every node, one row per layer, with routed edges', () => {
  const g = g3();
  const L = layoutGraph(g, { width: 900 });
  assert.equal(L.nodes.length, 3);
  assert.equal(L.edges.length, 2);
  assert.ok(L.width >= 900);
  assert.ok(L.height > 0);
  for (const n of L.nodes) { assert.ok(Number.isFinite(n.x) && Number.isFinite(n.y)); assert.ok(n.w >= 60); }
  const jane = L.byId.get(idOf(g, 'Jane Roe'));
  const hold = L.byId.get(idOf(g, 'Acme Holdings'));
  assert.ok(jane.y < hold.y, 'the holder sits above what it holds');
  for (const e of L.edges) { assert.equal(e.points.length, 4); assert.ok(e.points.every((p) => Number.isFinite(p.x) && Number.isFinite(p.y))); }
});

test('the exported SVG is well-formed and names every entity', () => {
  const svg = toSvg(layoutGraph(g3(), { width: 800 }), { title: 'Acme and its people' });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.trimEnd().endsWith('</svg>'));
  assert.match(svg, /Jane Roe/);
  assert.match(svg, /Acme Holdings/);
  assert.match(svg, /pm-arrow/);
  assert.match(svg, /Acme and its people/);
});

test('LittleSis entities and relationships map to a directed graph', () => {
  const entities = [
    { id: 1, name: 'Jane Roe', primary_ext: 'Person' },
    { id: 2, name: 'Acme Corp', primary_ext: 'Org' },
  ];
  const relationships = [{ entity1_id: 1, entity2_id: 2, category_id: 1 }];
  const g = fromLittleSis(entities, relationships);
  assert.equal(g.entities.length, 2);
  assert.equal(findEntity(g, idOf(g, 'Jane Roe')).kind, 'person');
  assert.equal(findEntity(g, idOf(g, 'Acme Corp')).kind, 'org');
  const r = g.relations[0];
  assert.equal(r.from, idOf(g, 'Jane Roe'), 'entity1 is the direction of the relation');
  assert.equal(r.to, idOf(g, 'Acme Corp'));
  assert.equal(r.category, 'position');
  assert.equal(isDag(g), true);
});

test('LittleSis API v2 shapes ({data:[...]}) import the same way', () => {
  const g = fromLittleSis(
    { data: [{ id: 7, attributes: { name: 'Fund X', primary_ext: 'Org' } }] },
    { data: [{ attributes: { entity1_id: 7, entity2_id: 7, category_id: 3 } }] });
  assert.equal(g.entities.length, 1);
  assert.equal(g.relations.length, 0, 'a self-relation is refused');
});

test('the Holodeck\'s own ties become a DAG, oriented from the weightier name', () => {
  const nodes = [{ n: 'A', c: 5, type: 'Person' }, { n: 'B', c: 2, type: 'Org' }, { n: 'C', c: 1 }];
  const edges = [{ a: 'A', b: 'B', c: 2 }, { a: 'B', b: 'C', c: 1 }, { a: 'C', b: 'A', c: 3 }];
  const g = fromTies(nodes, edges);
  assert.equal(isDag(g), true, 'outranks orientation cannot cycle');
  for (const r of g.relations) {
    const from = findEntity(g, r.from), to = findEntity(g, r.to);
    const cf = nodes.find((x) => x.n === from.name).c, ct = nodes.find((x) => x.n === to.name).c;
    assert.ok(cf > ct || (cf === ct && from.name < to.name), 'the weightier name is the source');
    assert.equal(r.category, 'tie');
    assert.equal(r.derived, true);
  }
  assert.equal(findEntity(g, idOf(g, 'A')).kind, 'person');
  assert.equal(findEntity(g, idOf(g, 'B')).kind, 'org');
});

test('JSON round-trips, dropping anything that would dangle', () => {
  const g = g3();
  const back = fromJSON(toJSON(g));
  assert.equal(back.entities.length, g.entities.length);
  assert.equal(back.relations.length, g.relations.length);
  assert.equal(isDag(back), true);
  const bad = fromJSON(JSON.stringify({ entities: [{ id: 'x', name: 'X' }], relations: [{ id: 'r', from: 'x', to: 'nope', category: 'tie' }] }));
  assert.equal(bad.relations.length, 0);
});

test('merging matches by name, not by id', () => {
  const g = g3();
  const other = fromLittleSis([{ id: 99, name: 'jane roe', primary_ext: 'Person' }, { id: 100, name: 'Acme Corp', primary_ext: 'Org' }], [{ entity1_id: 99, entity2_id: 100, category_id: 9 }]);
  const m = mergeGraph(g, other);
  assert.equal(m.entities.length, 4, 'Jane Roe is shared, Acme Corp is new');
  assert.equal(m.relations.length, 3);
  assert.equal(isDag(m), true);
});

test('stats name the shape and the acyclicity', () => {
  const s = graphStats(g3());
  assert.equal(s.entities, 3);
  assert.equal(s.relations, 2);
  assert.equal(s.dag, true);
  assert.equal(s.kinds.person, 1);
  assert.equal(s.kinds.org, 2);
  assert.match(s.summary, /3 entities · 2 relations · acyclic/);
});
