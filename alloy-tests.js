/* alloy-tests.js — solver test suite, runs in Node and in the A3 page. */
(function (root) {
  function runTests(highs, Core, Sample) {
    const results = [];
    const t = (name, fn) => {
      try { const detail = fn(); results.push({ name, pass: true, detail: detail || '' }); }
      catch (e) { results.push({ name, pass: false, detail: e.message }); }
    };
    const assert = (c, m) => { if (!c) throw new Error(m); };
    const near = (a, b, tol, m) => assert(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);

    // independent chemistry recompute from the recipe (does not use solver internals)
    function recompute(sc, recipe) {
      const f = sc.furnace; let M = f.heelLbs; const el = {};
      for (const e of sc.elements) el[e] = f.heelLbs * (f.heelComp[e] || 0) / 100;
      for (const r of recipe) {
        const it = sc.inventory.find(i => i.id === r.id);
        M += r.lbs * it.recovery;
        for (const e of sc.elements) el[e] += r.lbs * (it.comp[e] || 0) / 100 * (it.elementRecovery?.[e] ?? it.recovery);
      }
      return { M, pct: Object.fromEntries(sc.elements.map(e => [e, el[e] / M * 100])) };
    }
    function inSpec(sc, pct, tol = 1e-6) {
      for (const e of sc.elements) {
        const l = sc.alloy.limits[e]; if (!l) continue;
        if (l.min !== null && pct[e] < l.min - tol) throw new Error(`${e} ${pct[e].toFixed(4)} < min ${l.min}`);
        if (l.max !== null && pct[e] > l.max + tol) throw new Error(`${e} ${pct[e].toFixed(4)} > max ${l.max}`);
      }
    }

    for (const code of Sample.alloys.map(a => a.code)) {
      t(`${code}: optimal, in spec, within furnace and inventory limits`, () => {
        const sc = Sample.scenario(code);
        const out = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false });
        assert(out.status === 'optimal', `status ${out.status}`);
        const R = out.result;
        const chk = recompute(sc, R.recipe);
        near(chk.M, R.meltLbs, 0.5, 'melt mass');
        inSpec(sc, chk.pct);
        assert(R.meltLbs <= sc.furnace.maxLbs + 0.5 && R.meltLbs >= sc.furnace.minLbs - 0.5, 'furnace bounds');
        for (const r of R.recipe) {
          const it = sc.inventory.find(i => i.id === r.id);
          assert(r.lbs <= it.availableLbs + 0.5, `${r.id} over availability`);
          if (it.maxPct) assert(r.lbs <= it.maxPct / 100 * R.meltLbs + 0.5, `${r.id} over cap`);
        }
        near(R.cost, R.recipe.reduce((s, r) => s + r.lbs * r.unitCost, 0), 0.01, 'cost sum');
        return `$${R.cost.toFixed(0)} · ${R.costPerLbMelt.toFixed(4)} $/lb melt · ${R.solveMs.toFixed(0)} ms`;
      });
    }

    t('Target mode stays within cost tolerance and is closer to target', () => {
      const sc = Sample.scenario('6061');
      const a = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false }).result;
      const b = Core.solveScenario(highs, sc, { mode: 'target', costTolPct: 0.5, marginals: false }).result;
      assert(b.cost <= a.cost * 1.005 + 0.01, 'cost over tolerance');
      const dev = R => R.chem.filter(c => c.target !== null).reduce((s, c) => s + Math.abs(c.offTarget) / ((c.max ?? c.target) - (c.min ?? 0)), 0);
      assert(dev(b) <= dev(a) + 1e-6, `target deviation ${dev(b)} > ${dev(a)}`);
      inSpec(sc, recompute(sc, b.recipe).pct);
      return `deviation ${dev(a).toFixed(3)} → ${dev(b).toFixed(3)} for +$${(b.cost - a.cost).toFixed(0)}`;
    });

    t('Locked quantity is honoured', () => {
      const sc = Sample.scenario('6061', { overrides: { 'SCR-6063-EXT': { lockLbs: 50000 } } });
      const R = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false }).result;
      near(R.recipe.find(r => r.id === 'SCR-6063-EXT').lbs, 50000, 0.01, 'locked lbs');
    });

    t('Excluded item is not used', () => {
      const sc = Sample.scenario('6061', { overrides: { 'SCR-6061-INT': { exclude: true } } });
      const out = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false });
      assert(!out.result.recipe.some(r => r.id === 'SCR-6061-INT'), 'excluded item present');
    });

    t('Raising a used scrap price never lowers total cost', () => {
      const base = Core.solveScenario(highs, Sample.scenario('6061'), { mode: 'cost', marginals: false }).result;
      const used = base.recipe.filter(r => r.melt_class.includes('scrap') && r.lbs > 1).sort((x, y) => y.lbs - x.lbs)[0];
      const sc = Sample.scenario('6061', { overrides: { [used.id]: { cost: used.unitCost * 1.3 } } });
      const R = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false }).result;
      assert(R.cost >= base.cost - 0.01, 'cost decreased');
      return `${used.id} +30% → +$${(R.cost - base.cost).toFixed(0)}`;
    });

    t('Binding constraints have positive marginal value', () => {
      const out = Core.solveScenario(highs, Sample.scenario('6061'), { mode: 'cost' });
      assert(out.binding.length > 0, 'no binding constraints found');
      assert(out.marginals.every(m => m.saving >= 0), 'negative saving');
      return out.marginals.slice(0, 2).map(m => `${m.label}: $${m.saving.toFixed(0)}`).join('; ');
    });

    t('Infeasible case is diagnosed with actionable relaxations', () => {
      // 6063 from dirty scrap only: Cu and Fe cannot be diluted
      const ov = {};
      for (const it of Sample.inventory) if (!['SCR-MIX6', 'SCR-UBC', 'SCR-6061-INT'].includes(it.id)) ov[it.id] = { exclude: true };
      const out = Core.solveScenario(highs, Sample.scenario('6063', { overrides: ov }), { mode: 'cost' });
      assert(out.status === 'infeasible', `status ${out.status}`);
      const d = out.diagnosis;
      assert(d.spec.feasible && d.spec.violations.length, 'no spec relaxation reported');
      return d.spec.violations.map(v => v.text).join('; ');
    });

    t('Inventory shortfall diagnosis suggests purchase quantity', () => {
      // only P1020 (20,000 lbs on hand) and hardeners: the furnace cannot be filled
      const ov = { 'PRI-1020': { availableLbs: 20000 } };
      for (const it of Sample.inventory) if (it.id !== 'PRI-1020' && it.melt_class !== 'hardener') ov[it.id] = { exclude: true };
      const out = Core.solveScenario(highs, Sample.scenario('6063', { overrides: ov }), { mode: 'cost' });
      assert(out.status === 'infeasible', `status ${out.status}`);
      const inv = out.diagnosis.inventory;
      assert(inv.feasible && inv.violations.some(v => v.kind === 'inventory'), 'no inventory relaxation');
      return inv.violations.map(v => v.text).join('; ');
    });

    t('Must-use (at least) item appears with at least that quantity', () => {
      const sc = Sample.scenario('6061', { overrides: { 'SCR-A356-WHL': { minLbs: 5000 }, 'PRI-1020': { minLbs: 20000 } } });
      const out = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false });
      assert(out.status === 'optimal', `status ${out.status}`);
      const R = out.result;
      assert(R.recipe.find(r => r.id === 'SCR-A356-WHL').lbs >= 5000 - 1e-6, 'A356 scrap below minimum');
      assert(R.recipe.find(r => r.id === 'PRI-1020').lbs >= 20000 - 1e-6, 'primary below minimum');
      inSpec(sc, recompute(sc, R.recipe).pct);
      assert(out.mandates && out.mandates.premium >= 0, 'premium missing');
      return `must-use premium $${out.mandates.premium.toFixed(0)}`;
    });

    t('Must-use above availability is rejected before solving', () => {
      const out = Core.solveScenario(highs, Sample.scenario('6061', { overrides: { 'HRD-CR20': { minLbs: 9000 } } }));
      assert(out.status === 'invalid' && out.validation.errors.some(e => /exceeds/.test(e)), 'not rejected');
    });

    t('Infeasibility caused by must-use items is identified', () => {
      // 60,000 lbs of A356 wheel scrap (7% Si) cannot fit a 6063 melt
      const out = Core.solveScenario(highs, Sample.scenario('6063', { overrides: { 'SCR-A356-WHL': { lockLbs: 60000 } } }), { mode: 'cost' });
      assert(out.status === 'infeasible', `status ${out.status}`);
      assert(out.diagnosis.mandates?.feasible, 'should be feasible without must-use items');
      return `feasible without must-use items at $${out.diagnosis.mandates.cost.toFixed(0)}`;
    });

    t('Heel alloy and weight feed the chemistry', () => {
      const sc = Sample.scenario('6061');
      sc.furnace.heelLbs = 30000; sc.furnace.heelComp = Core.heelChemFromAlloy(Sample.alloys.find(a => a.code === '6061'), sc.elements);
      const R = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false }).result;
      const chk = recompute(sc, R.recipe);
      near(chk.M, R.meltLbs, 0.5, 'melt mass with heel');
      inSpec(sc, chk.pct);
      near(R.heelLbs, 30000, 1e-6, 'heel lbs');
      const sc0 = Sample.scenario('6061'); sc0.furnace.heelLbs = 0;
      const R0 = Core.solveScenario(highs, sc0, { mode: 'cost', marginals: false }).result;
      inSpec(sc0, recompute(sc0, R0.recipe).pct);
      return `30,000 lbs 6061 heel $${R.cost.toFixed(0)} vs empty furnace $${R0.cost.toFixed(0)}`;
    });

    t('Heel plus must-use items larger than the furnace is rejected', () => {
      const sc = Sample.scenario('6061', { overrides: { 'PRI-1020': { lockLbs: 190000 } } });
      sc.furnace.heelLbs = 20000;
      const out = Core.solveScenario(highs, sc);
      assert(out.status === 'invalid', `status ${out.status}`);
    });

    t('Pinned chemistry is hit exactly and its cost impact reported', () => {
      const sc = Sample.scenario('6061', { chemPins: { Mg: 1.10, Si: 0.70 } });
      const out = Core.solveScenario(highs, sc, { mode: 'target', marginals: false });
      assert(out.status === 'optimal', `status ${out.status}`);
      const pct = recompute(sc, out.result.recipe).pct;
      near(pct.Mg, 1.10, 1e-4, 'Mg pin'); near(pct.Si, 0.70, 1e-4, 'Si pin');
      assert(out.pins && out.pins.delta !== null && out.pins.delta >= -0.01, 'pin delta should be ≥ 0 (pinning only adds constraints)');
      return `Mg 1.10 + Si 0.70 → +$${out.pins.delta.toFixed(0)} vs unpinned`;
    });

    t('Unreachable pin is diagnosed as the cause', () => {
      const out = Core.solveScenario(highs, Sample.scenario('6061', { chemPins: { Fe: 0.03 } }), { mode: 'cost' });
      assert(out.status === 'infeasible', `status ${out.status}`);
      assert(out.diagnosis.pins?.feasible, 'unpinned should be feasible');
    });

    // share of melt lbs from a set of melt classes, recomputed from the recipe
    function classShare(sc, recipe, classes) {
      const M = recompute(sc, recipe).M;
      return recipe.reduce((s, r) => { const it = sc.inventory.find(i => i.id === r.id); return s + (classes.includes(it.melt_class) ? r.lbs * it.recovery : 0); }, 0) / M * 100;
    }

    t('Default melt-mix limits (0–100 %) add no constraints', () => {
      const out = Core.solveScenario(highs, Sample.scenario('6061', { classLimits: { primary: { min: 0, max: 100 } } }), { mode: 'cost', marginals: false });
      assert(!/grp(min|max)_/.test(out.lp), 'LP has melt-mix rows');
    });

    t('Melt-mix min / max limits are honoured', () => {
      const base = Core.solveScenario(highs, Sample.scenario('6061'), { mode: 'cost', marginals: false });
      const sc = Sample.scenario('6061', { classLimits: { primary: { min: 25 }, internal_scrap: { max: 30 }, scrap: { min: 50, max: 70 } } });
      const out = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false });
      assert(out.status === 'optimal', `status ${out.status}`);
      const R = out.result, pri = classShare(sc, R.recipe, ['primary']), int = classShare(sc, R.recipe, ['internal_scrap']), all = classShare(sc, R.recipe, ['internal_scrap', 'purchased_scrap']);
      assert(pri >= 25 - 1e-4, `primary ${pri}`); assert(int <= 30 + 1e-4, `internal ${int}`); assert(all >= 50 - 1e-4 && all <= 70 + 1e-4, `scrap ${all}`);
      near(R.groupShare.primary, pri, 1e-4, 'reported primary share');
      inSpec(sc, recompute(sc, R.recipe).pct);
      assert(R.cost >= base.result.cost - 0.01, 'extra limits lowered cost');
      return `primary ${pri.toFixed(1)}% · internal ${int.toFixed(1)}% · scrap ${all.toFixed(1)}% → +$${(R.cost - base.result.cost).toFixed(0)}`;
    });

    t('Must-use items above a melt-mix max are flagged', () => {
      const sc = Sample.scenario('6061', { overrides: { 'SCR-6061-INT': { lockLbs: 100000 } }, classLimits: { internal_scrap: { max: 20 } } });
      const out = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false });
      const c = out.classConflicts.find(x => x.group === 'internal_scrap' && x.bound === 'max');
      assert(c && c.items.includes('SCR-6061-INT'), 'conflict not flagged');
      assert(out.status === 'infeasible', `status ${out.status}`);
      return c.text;
    });

    t('Must-use items crowding out a melt-mix min are flagged', () => {
      const sc = Sample.scenario('6061', { overrides: { 'PRI-1020': { lockLbs: 150000 } }, classLimits: { scrap: { min: 50 } } });
      const out = Core.solveScenario(highs, sc, { mode: 'cost', marginals: false });
      const c = out.classConflicts.find(x => x.group === 'scrap' && x.bound === 'min');
      assert(c && c.items.includes('PRI-1020'), 'conflict not flagged');
      const ok = Core.solveScenario(highs, Sample.scenario('6061', { classLimits: { scrap: { min: 50 } } }), { mode: 'cost', marginals: false });
      assert(!ok.classConflicts.length, 'false conflict without must-use items');
      return c.text;
    });

    t('Melt-mix limits that cannot hold are rejected', () => {
      for (const cl of [{ primary: { min: 60, max: 40 } }, { primary: { min: 60 }, scrap: { min: 50 } }, { scrap: { max: 120 } }]) {
        const out = Core.solveScenario(highs, Sample.scenario('6061', { classLimits: cl }));
        assert(out.status === 'invalid', `${JSON.stringify(cl)} not rejected`);
      }
    });

    t('Validation rejects bad input', () => {
      const sc = Sample.scenario('6061');
      sc.inventory[0].recovery = 1.4; sc.inventory[1].comp.Si = 120;
      const out = Core.solveScenario(highs, sc);
      assert(out.status === 'invalid' && out.validation.errors.length >= 2, 'not rejected');
    });

    return results;
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { runTests };
  else root.AlloyTests = { runTests };
})(typeof globalThis !== 'undefined' ? globalThis : this);
