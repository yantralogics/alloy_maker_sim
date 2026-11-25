const Core = require('../alloy-core.js'), Sample = require('../sample-data.js'), { runTests } = require('../alloy-tests.js');
require('highs')().then(highs => {
  const r = runTests(highs, Core, Sample);
  for (const x of r) console.log(x.pass ? 'PASS' : 'FAIL', x.name, '—', x.detail);
  const out = Core.solveScenario(highs, Sample.scenario('6061'));
  console.log(JSON.stringify({mode: out.mode, cost: out.result.cost, recipe: out.result.recipe.filter(r=>r.lbs>1).map(r=>[r.id, Math.round(r.lbs)]), chem: out.result.chem.map(c=>[c.el, +c.pct.toFixed(3)]), binding: out.binding.map(b=>b.label), marg: out.marginals}, null, 0));
  process.exit(r.every(x=>x.pass)?0:1);
});
