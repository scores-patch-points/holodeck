// drive.js — drives the Ask of the page it is loaded in, through its real code (window.__hdApp.analysis() and qaVals()), over the 21
// frozen PARA-GOLD v0 texts, for every question of QSET-1 and the three extra labelled ones, and posts the RAW result to the collector.
// It scores nothing. Usage (in the page, URL carries the switches): (await import('./eval/e2e/drive.js')).run('base')
export async function run(arm, { questions, collector = 'http://127.0.0.1:8815', toy = false } = {}) {
  const app = window.__hdApp, hd = window.__holodeck; const t0 = performance.now();
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  await window.__hdL34Ready; for (let i = 0; i < 300 && !(hd.hdReaderReady && hd.hdReaderReady()); i++) await sleep(200);
  const ids = toy ? ['toy'] : await (await fetch('./eval/e2e/docs.json')).json();
  const docs = []; for (const id of ids) { const text = toy ? 'The Zorn Bridge is a steel bridge. It is 120 metres long and was built in 1931.' : await (await fetch('./tools/paragold/v0/text/' + id + '.txt')).text(); docs.push({ id, title: id, text, type: 'Text', format: 'text' }); }
  app.setState({ corpus: 'custom', added: { custom: docs }, htmlVer: 1 }); app._key = null;
  let A = null, spins = 0;
  for (; spins < 600; spins++) { A = app.analysis(); const m = hd.masterReads(); if (m.pending === 0 && m.read >= docs.length) break; await sleep(500); }
  const m = hd.masterReads(); app._key = null; A = app.analysis();
  const norm = (t) => String(t).replace(/\s+/g, ' ').trim();
  const perDoc = {}; A.sts.forEach((st) => { const r = perDoc[st.doc] || (perDoc[st.doc] = { statements: 0, bound: 0, gapped: 0, names: 0 }); r.statements++; r.names += st.names.length; if (st.attended) r.bound++; if (st.attendedGaps) r.gapped++; });
  app._cnt = new Set(A.docs.filter((d) => app.counted(d)).map((d) => d.id));
  const F = A.sts.filter((st) => app.match(st, A));
  const out = [];
  for (const q of questions || (toy ? [{ id: 't1', q: 'How long is the Zorn Bridge?' }] : [])) {
    app.setState({ q: q.q }); const r = app.qaVals(A, F, q.q, 'search').qa;
    out.push({ id: q.id, q: q.q, noAnswer: !!r.noAnswer, candTitle: r.candTitle || '', cands: (r.cands || []).map((c) => ({ label: c.label, meta: c.meta })),
      passages: (r.passages || []).map((p) => { const text = p.parts.map((x) => x.t).join(''); return { text, docs: [...new Set(A.sts.filter((st) => norm(st.text) === norm(text)).map((st) => st.doc))] }; }), missing: r.hasMissing ? r.missing : null });
  }
  const bound = A.sts.filter((st) => st.attended).length, gapped = A.sts.filter((st) => st.attendedGaps).length;
  const gapsByReason = {}; A.sts.forEach((st) => (st.attendedGaps || []).forEach((g) => { gapsByReason[g.reason] = (gapsByReason[g.reason] || 0) + 1; }));
  const result = { schema: 'E2ERaw@0', arm, url: location.search, switches: window.__hdL34Sw || null,
    docs: docs.length, statements: A.sts.length, masterReads: m, spins, perDoc, statementsWithBinding: bound, statementsWithTypedGap: gapped, gapsByReason, ms: Math.round(performance.now() - t0), results: out };
  const body = JSON.stringify(result);
  const resp = await fetch(collector + '/?arm=' + encodeURIComponent(arm), { method: 'POST', body }); return { post: await resp.text(), bytes: body.length, summary: { docs: docs.length, statements: A.sts.length, masterReads: m, bound, gapped, ms: result.ms } };
}
