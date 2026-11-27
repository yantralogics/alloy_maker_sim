/* alloy-core.js — Alloy Maker Simulator shared core (A3, reused unchanged in A4)
 * Least-cost aluminum furnace charge as an LP, solved with HiGHS (highs-js).
 * Units: mass lbs, cost $/lb, composition wt%.
 * Works in the browser (window.AlloyCore) and in Node (module.exports).
 */
(function (root) {
  'use strict';
  const VERSION = '0.5.0';
  const MELT_CLASSES = ['primary', 'hardener', 'internal_scrap', 'purchased_scrap'];
  const TOL = 1e-6;
  // Melt-mix groups: share of melt lbs (heel included in the total) coming from these melt classes.
  const CLASS_GROUPS = [
    { key: 'primary', label: 'Primary', classes: ['primary'] },
    { key: 'internal_scrap', label: 'Internal scrap', classes: ['internal_scrap'] },
    { key: 'scrap', label: 'All scrap', classes: ['internal_scrap', 'purchased_scrap'] }
  ];

  // ---------- helpers ----------
  const num = v => (v === '' || v === null || v === undefined || Number.isNaN(+v)) ? null : +v;
  const fmt = v => {
    if (Math.abs(v) < 1e-14) return '0';
    const s = (+v).toPrecision(12);
    return s.includes('e') ? s : s.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
  };
  const vname = id => 'x_' + String(id).replace(/[^A-Za-z0-9_]/g, '_');
  const rname = s => String(s).replace(/[^A-Za-z0-9_]/g, '_');
  function linexpr(terms) {
    // terms: [[coef, var], ...] -> "+ 1.2 x_a - 3 M"
    const parts = [];
    for (const [c, v] of terms) {
      if (!c || Math.abs(c) < 1e-14) continue;
      parts.push((c < 0 ? '- ' : '+ ') + fmt(Math.abs(c)) + ' ' + v);
    }
    if (!parts.length) parts.push('+ 0 ' + terms[0][1]);
    let s = parts.join(' ');
    if (s.startsWith('+ ')) s = s.slice(2);
    // HiGHS LP reader wants lines under ~255 chars; wrap
    const out = []; let line = '';
    for (const tok of s.split(' ')) {
      if ((line + ' ' + tok).length > 200) { out.push(line); line = '  ' + tok; }
      else line = line ? line + ' ' + tok : tok;
    }
    out.push(line);
    return out.join('\n');
  }

  // ---------- validation ----------
  function validateScenario(sc) {
    const errors = [], warnings = [];
    const els = sc.elements || [];
    if (!els.length) errors.push('No elements defined.');
    const alloy = sc.alloy;
    if (!alloy) errors.push('No target alloy selected.');
    const f = sc.furnace || {};
    if (!(num(f.maxLbs) > 0)) errors.push('Furnace max charge (lbs) must be > 0.');
    if (num(f.minLbs) !== null && num(f.minLbs) > num(f.maxLbs)) errors.push('Furnace min fill is above max.');
    if ((num(f.heelLbs) || 0) > (num(f.maxLbs) || 0)) errors.push('Heel is larger than the furnace max.');
    // Optional fixed melt weight (heel included); blank lets the optimizer choose within min fill and max.
    const melt = num(f.meltLbs);
    if (melt !== null) {
      const lo = num(f.minLbs) ?? 0, hi = num(f.maxLbs) ?? Infinity, L = v => Math.round(v).toLocaleString('en-US');
      if (melt < lo || melt > hi) errors.push(`Melt weight ${L(melt)} lbs is outside the furnace range (${L(lo)} to ${L(hi)} lbs).`);
      else if (melt < (num(f.heelLbs) || 0)) errors.push(`Melt weight ${L(melt)} lbs is less than the heel.`);
    }
    for (const it of sc.inventory || []) {
      const tag = `Item ${it.id}`;
      if (!MELT_CLASSES.includes(it.melt_class)) warnings.push(`${tag}: unknown melt_class "${it.melt_class}".`);
      if (!(num(it.cost) >= 0)) errors.push(`${tag}: cost must be ≥ 0.`);
      const r = num(it.recovery);
      if (!(r > 0 && r <= 1)) errors.push(`${tag}: recovery must be in (0, 1].`);
      let sum = 0;
      for (const e of els) sum += num(it.comp?.[e]) || 0;
      if (sum > 100.0001) errors.push(`${tag}: listed elements sum to ${sum.toFixed(2)} wt% (> 100).`);
      if (num(it.minLbs) !== null && num(it.maxLbs) !== null && num(it.minLbs) > num(it.maxLbs)) errors.push(`${tag}: min lbs above max lbs.`);
    }
    const inv = Object.fromEntries((sc.inventory || []).map(i => [i.id, i]));
    for (const [id, o] of Object.entries(sc.overrides || {})) {
      const it = inv[id]; if (!it) { warnings.push(`Override for unknown item ${id} ignored.`); continue; }
      const avail = num(o.availableLbs) ?? num(it.availableLbs);
      const need = num(o.lockLbs) ?? num(o.minLbs);
      if (o.exclude && need) errors.push(`${it.name}: marked both must-use and excluded.`);
      if (need !== null && need < 0) errors.push(`${it.name}: must-use lbs cannot be negative.`);
      if (need !== null && avail !== null && need > avail + 1e-6) errors.push(`${it.name}: must-use ${Math.round(need).toLocaleString('en-US')} lbs exceeds the ${Math.round(avail).toLocaleString('en-US')} lbs available.`);
    }
    const mandatedLbs = Object.entries(sc.overrides || {}).reduce((s, [id, o]) => s + (inv[id] ? (num(o.lockLbs) ?? num(o.minLbs) ?? 0) * (num(inv[id].recovery) ?? 1) : 0), 0);
    if (mandatedLbs + (num(f.heelLbs) || 0) > (melt ?? num(f.maxLbs) ?? Infinity) + 1e-6) errors.push(`Heel plus must-use items (${Math.round(mandatedLbs + (num(f.heelLbs) || 0)).toLocaleString('en-US')} lbs after melt loss) exceed the ${melt !== null ? 'melt weight' : 'furnace max'}.`);
    if (alloy) for (const e of els) {
      const l = alloy.limits?.[e]; if (!l) continue;
      if (num(l.min) !== null && num(l.max) !== null && num(l.min) > num(l.max)) errors.push(`${alloy.code} ${e}: min above max.`);
      if (num(l.target) !== null) {
        if (num(l.min) !== null && num(l.target) < num(l.min)) warnings.push(`${alloy.code} ${e}: target below min.`);
        if (num(l.max) !== null && num(l.target) > num(l.max)) warnings.push(`${alloy.code} ${e}: target above max.`);
      }
    }
    for (const [e, v] of Object.entries(sc.chemPins || {})) {
      if (!els.includes(e)) { warnings.push(`Pin for unknown element ${e} ignored.`); continue; }
      if (num(v) === null || num(v) < 0) { errors.push(`${e} pin must be a number ≥ 0.`); continue; }
      const l = alloy?.limits?.[e] || {};
      if ((num(l.min) !== null && num(v) < num(l.min)) || (num(l.max) !== null && num(v) > num(l.max))) warnings.push(`${e} pinned at ${(+v).toFixed(3)} wt% is outside the ${alloy.code} spec.`);
    }
    const gl = groupLimits(sc);
    for (const g of gl) {
      if (g.min < 0 || g.max > 100) errors.push(`${g.label} limits must be between 0 and 100 % of melt.`);
      if (g.min > g.max) errors.push(`${g.label}: min ${g.min}% is above max ${g.max}%.`);
    }
    const G = Object.fromEntries(gl.map(g => [g.key, g]));
    if (G.primary.min + G.scrap.min > 100) errors.push(`Primary min (${G.primary.min}%) plus all-scrap min (${G.scrap.min}%) exceed 100 % of melt.`);
    if (G.internal_scrap.min > G.scrap.max) errors.push(`Internal scrap min (${G.internal_scrap.min}%) is above the all-scrap max (${G.scrap.max}%).`);
    return { ok: !errors.length, errors, warnings };
  }

  // Melt-mix limits with defaults (0–100 %).
  function groupLimits(sc) {
    const cl = sc.classLimits || {};
    return CLASS_GROUPS.map(g => ({ ...g, min: num(cl[g.key]?.min) ?? 0, max: num(cl[g.key]?.max) ?? 100 }));
  }

  /* Melt-mix limits that the must-use / exact / excluded items make impossible, before any chemistry.
   * Group lbs S lie in [mandated, cap] and the melt M = heel + S + other; the share S/M is checked at its extremes. */
  function classLimitConflicts(sc) {
    const p = prepare(sc), out = [];
    const inv = sc.inventory || [], ov = sc.overrides || {};
    const pct = v => `${(v * 100).toFixed(1)}%`;
    for (const g of p.groups) {
      const inG = it => g.classes.includes(it.melt_class);
      const G = p.items.filter(inG), O = p.items.filter(it => !inG(it));
      const sum = (xs, f) => xs.reduce((s, it) => s + it.r * f(it), 0);
      const mandG = sum(G, it => it.lo), capG = sum(G, it => it.hi === Infinity ? p.Mmax : it.hi);
      const mandO = sum(O, it => it.lo), capO = sum(O, it => it.hi === Infinity ? p.Mmax : it.hi);
      const excluded = want => inv.filter(it => ov[it.id]?.exclude && g.classes.includes(it.melt_class) === want).map(it => it.id);
      const fixed = (xs, f) => xs.filter(f).map(it => it.id);
      if (g.min > 0) {
        const S = Math.min(capG, p.Mmax - p.H - mandO);
        const best = S > 0 ? S / Math.max(p.Mmin, p.H + mandO + S) : 0;
        if (best < g.min / 100 - TOL) {
          const items = [...fixed(O, it => it.mandated), ...fixed(G, it => it.locked), ...excluded(true)];
          out.push({ group: g.key, bound: 'min', items, best: best * 100,
            text: `${g.label} can reach at most ${pct(best)} of the melt with the current heel${items.length ? ' and pre-assigned items' : ''}, below the ${g.min}% min.` });
        }
      }
      if (g.max < 100) {
        const M = Math.min(p.Mmax, p.H + mandG + capO);
        const least = M > 0 ? mandG / M : 0;
        if (least > g.max / 100 + TOL) {
          const items = [...fixed(G, it => it.mandated), ...fixed(O, it => it.locked), ...excluded(false)];
          out.push({ group: g.key, bound: 'max', items, least: least * 100,
            text: `Must-use ${g.label.toLowerCase()} items put at least ${pct(least)} of the melt in this class, above the ${g.max}% max.` });
        }
      }
    }
    return out;
  }

  // ---------- model ----------
  // Normalised view of a scenario: items with effective bounds after overrides/locks.
  function prepare(sc) {
    const els = sc.elements;
    const f = sc.furnace;
    const H = num(f.heelLbs) || 0;
    const heel = f.heelComp || {};
    const ov = sc.overrides || {};
    const items = [];
    for (const it of sc.inventory) {
      const o = ov[it.id] || {};
      if (o.exclude) continue;
      const cost = num(o.cost) ?? num(it.cost);
      const avail = num(o.availableLbs) ?? num(it.availableLbs);
      let lo = num(o.minLbs) ?? num(it.minLbs) ?? 0;
      let hi = avail ?? Infinity;
      const maxL = num(o.maxLbs) ?? num(it.maxLbs);
      if (maxL !== null) hi = Math.min(hi, maxL);
      const lock = num(o.lockLbs);
      if (lock !== null) { lo = lock; hi = lock; }
      const r = num(it.recovery) ?? 1;
      const k = {}; // lbs of element in melt per lb charged
      for (const e of els) {
        const a = num(it.comp?.[e]) || 0;
        const er = num(it.elementRecovery?.[e]) ?? r;
        k[e] = a / 100 * er;
      }
      items.push({
        id: it.id, name: it.name, melt_class: it.melt_class, v: vname(it.id), cost, r, k,
        lo, hi, avail: avail ?? Infinity, locked: lock !== null, mandated: lo > 0,
        maxPct: num(o.maxPct) ?? num(it.maxPct)
      });
    }
    const limits = {};
    const pins = sc.chemPins || {};
    for (const e of els) {
      const l = sc.alloy.limits?.[e] || {};
      limits[e] = { min: num(l.min), max: num(l.max), target: num(l.target) };
      // A pinned element is held at exactly that wt% (what-if); its spec range is kept for display.
      if (num(pins[e]) !== null) limits[e] = { ...limits[e], specMin: limits[e].min, specMax: limits[e].max, pinned: num(pins[e]), min: num(pins[e]), max: num(pins[e]), target: null };
    }
    return {
      els, items, limits, H, heel, groups: groupLimits(sc),
      Mmin: num(f.meltLbs) ?? num(f.minLbs) ?? 0, Mmax: num(f.meltLbs) ?? num(f.maxLbs), meltFixed: num(f.meltLbs) !== null,
      heelEl: Object.fromEntries(els.map(e => [e, H * (num(heel[e]) || 0) / 100]))
    };
  }

  /* buildLP(p, opts)
   * opts.mode: 'cost' | 'target' | 'elastic'
   * opts.costCap: number (target mode: Σ c x ≤ costCap)
   * opts.relax: { spec: bool, inventory: bool } (elastic mode)
   * opts.limitShift: { [rowName]: deltaWtPctOrLbs } for marginal re-solves
   * mode 'stable': among charges no worse than costCap (and devCap, the target deviation, when given),
   *   pick the one closest to opts.base ({ [var]: lbs }). Used so a pinned charge only differs from
   *   its unpinned baseline where the pin requires it, not by swapping between equally cheap items.
   */
  function buildLP(p, opts = {}) {
    const mode = opts.mode || 'cost';
    const shift = opts.limitShift || {};
    const obj = [], rows = [], bounds = [];
    const Mref = p.Mmax;
    const extraVars = [];
    const useTargets = mode === 'target' || (mode === 'stable' && opts.devCap !== undefined && opts.devCap !== null);
    const devTerms = [];
    if (mode === 'cost') for (const it of p.items) obj.push([it.cost, it.v]);

    // melt mass balance: M - Σ r x = H
    rows.push(['mass', linexpr([[1, 'M'], ...p.items.map(it => [-it.r, it.v])]), '=', p.H]);

    for (const e of p.els) {
      const L = p.limits[e];
      const kt = it => it.k[e];
      const base = p.items.map(it => [kt(it), it.v]);
      if (L.min !== null) {
        const lim = L.min + (shift[`min_${e}`] || 0);
        const terms = [...base, [-lim / 100, 'M']];
        if (mode === 'elastic' && opts.relax?.spec) { terms.push([1, `sL_${e}`]); extraVars.push([`sL_${e}`, 100 / Mref]); }
        rows.push([rname(`min_${e}`), linexpr(terms), '>=', -p.heelEl[e]]);
      }
      if (L.max !== null) {
        const lim = L.max + (shift[`max_${e}`] || 0);
        const terms = [...base, [-lim / 100, 'M']];
        if (mode === 'elastic' && opts.relax?.spec) { terms.push([-1, `sU_${e}`]); extraVars.push([`sU_${e}`, 100 / Mref]); }
        rows.push([rname(`max_${e}`), linexpr(terms), '<=', -p.heelEl[e]]);
      }
      if (useTargets && L.target !== null) {
        const width = (L.min !== null && L.max !== null) ? Math.max(L.max - L.min, 1e-3) : Math.max(L.max ?? L.target, 1e-3);
        const w = 100 / (Mref * width); // per lb of element deviation → wt% / range-width
        rows.push([rname(`tgt_${e}`), linexpr([...base, [-L.target / 100, 'M'], [-1, `dP_${e}`], [1, `dM_${e}`]]), '=', -p.heelEl[e]]);
        (mode === 'target' ? obj : devTerms).push([w, `dP_${e}`], [w, `dM_${e}`]);
      }
    }
    // percentage caps: x ≤ pct/100 · M
    for (const it of p.items) if (it.maxPct !== null && it.maxPct !== undefined) {
      const lim = it.maxPct + (shift[`cap_${it.id}`] || 0);
      const terms = [[1, it.v], [-lim / 100, 'M']];
      if (mode === 'elastic' && opts.relax?.inventory) { terms.push([-1, `sC_${rname(it.id)}`]); extraVars.push([`sC_${rname(it.id)}`, 100 / Mref]); }
      rows.push([rname(`cap_${it.id}`), linexpr(terms), '<=', 0]);
    }
    // melt-mix limits: Σ_group r x  ≥ / ≤  pct/100 · M
    for (const g of p.groups) {
      const terms = p.items.filter(it => g.classes.includes(it.melt_class)).map(it => [it.r, it.v]);
      for (const [b, lim0, sense, sl] of [['min', g.min, '>=', 1], ['max', g.max, '<=', -1]]) {
        if (b === 'min' ? lim0 <= 0 : lim0 >= 100) continue;
        const row = `grp${b}_${g.key}`, lim = lim0 + (shift[row] || 0);
        const t = [...terms, [-lim / 100, 'M']];
        if (mode === 'elastic' && opts.relax?.inventory) { t.push([sl, `sG_${row}`]); extraVars.push([`sG_${row}`, 100 / Mref]); }
        rows.push([row, linexpr(t), sense, 0]);
      }
    }
    if (mode === 'target' || mode === 'stable') rows.push(['costcap', linexpr(p.items.map(it => [it.cost, it.v])), '<=', opts.costCap]);
    if (mode === 'stable') {
      if (devTerms.length) rows.push(['devcap', linexpr(devTerms), '<=', opts.devCap]);
      // x - up + down = base; minimise total movement (lbs, scaled like the other penalties)
      for (const it of p.items) {
        const up = `mU_${rname(it.id)}`, dn = `mD_${rname(it.id)}`;
        rows.push([rname(`stb_${it.id}`), linexpr([[1, it.v], [-1, up], [1, dn]]), '=', opts.base?.[it.v] || 0]);
        extraVars.push([up, 1 / Mref], [dn, 1 / Mref]);
      }
    }

    // bounds; availability shortfall as purchase slack in elastic-inventory mode
    for (const it of p.items) {
      let hi = it.hi + (shift[`avail_${it.id}`] || 0);
      if (mode === 'elastic' && opts.relax?.inventory && !it.locked) {
        const b = `sB_${rname(it.id)}`;
        rows.push([rname(`avail_${it.id}`), linexpr([[1, it.v], [-1, b]]), '<=', hi]);
        extraVars.push([b, 100 / Mref]);
        hi = Infinity;
      }
      bounds.push(`${fmt(it.lo)} <= ${it.v} <= ${hi === Infinity ? '+inf' : fmt(hi)}`);
    }
    bounds.push(`${fmt(p.Mmin)} <= M <= ${fmt(p.Mmax)}`);
    if (useTargets) for (const e of p.els) if (p.limits[e].target !== null) bounds.push(`dP_${e} >= 0`, `dM_${e} >= 0`);
    for (const [v, w] of extraVars) { obj.push([w, v]); bounds.push(`${v} >= 0`); }
    if (!obj.length) obj.push([0, 'M']);

    const lp = ['Minimize', ' obj: ' + linexpr(obj), 'Subject To',
      ...rows.map(([n, ex, s, rhs]) => ` ${n}: ${ex} ${s} ${fmt(rhs)}`),
      'Bounds', ...bounds.map(b => ' ' + b), 'End'].join('\n');
    return lp;
  }

  function runHighs(highs, lp) {
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    const res = highs.solve(lp, { presolve: 'on' });
    res.ms = (typeof performance !== 'undefined' ? performance : Date).now() - t0;
    return res;
  }
  const isOptimal = r => r && r.Status === 'Optimal';

  // ---------- results ----------
  function parse(p, res) {
    const C = res.Columns;
    const M = C.M.Primal;
    const recipe = p.items.map(it => {
      const col = C[it.v];
      const lbs = Math.max(0, col ? col.Primal : 0);
      return {
        id: it.id, name: it.name, melt_class: it.melt_class, lbs, cost: lbs * it.cost, unitCost: it.cost,
        meltLbs: lbs * it.r, pctCharge: 0, reducedCost: col ? col.Dual : 0, atUpper: lbs >= it.hi - 1e-3 && it.hi < Infinity,
        avail: it.avail, locked: it.locked, mandated: it.mandated, minLbs: it.lo
      };
    });
    const chargeLbs = recipe.reduce((s, r) => s + r.lbs, 0);
    recipe.forEach(r => r.pctCharge = chargeLbs ? r.lbs / chargeLbs * 100 : 0);
    const chem = p.els.map(e => {
      const elLbs = p.heelEl[e] + p.items.reduce((s, it) => s + it.k[e] * Math.max(0, C[it.v]?.Primal || 0), 0);
      const pct = M > 0 ? elLbs / M * 100 : 0;
      const L = p.limits[e];
      const contrib = [{ id: '__heel', name: 'Heel', lbs: p.heelEl[e] }].concat(
        p.items.map(it => ({ id: it.id, name: it.name, lbs: it.k[e] * Math.max(0, C[it.v]?.Primal || 0) })).filter(c => c.lbs > 1e-9));
      return {
        el: e, pct, ...L,
        min: L.pinned !== undefined ? L.specMin : L.min, max: L.pinned !== undefined ? L.specMax : L.max, pinned: L.pinned ?? null,
        marginMin: L.min !== null ? pct - L.min : null,
        marginMax: L.max !== null ? L.max - pct : null,
        offTarget: L.target !== null ? pct - L.target : null,
        contrib
      };
    });
    const cost = recipe.reduce((s, r) => s + r.cost, 0);
    const rows = res.Rows.map(r => ({ name: r.Name, primal: r.Primal, dual: r.Dual, lower: r.Lower, upper: r.Upper, status: r.Status }));
    const binding = [];
    for (const r of rows) {
      if (['mass', 'costcap'].includes(r.name) || r.name.startsWith('tgt_')) continue;
      const atU = Number.isFinite(r.upper) && Math.abs(r.primal - r.upper) < 1e-4 * Math.max(1, Math.abs(r.upper));
      const atL = Number.isFinite(r.lower) && Math.abs(r.primal - r.lower) < 1e-4 * Math.max(1, Math.abs(r.lower));
      if ((atU || atL) && Math.abs(r.dual) > 1e-9) binding.push({ row: r.name, dual: r.dual });
    }
    for (const it of recipe) if (it.atUpper && !it.locked) binding.push({ row: `avail_${rname(it.id)}`, dual: it.reducedCost });
    if (p.meltFixed) binding.push({ row: 'furnace_melt', dual: C.M.Dual });
    else {
      if (Math.abs(M - p.Mmax) < 1e-3) binding.push({ row: 'furnace_max', dual: C.M.Dual });
      if (p.Mmin > 0 && Math.abs(M - p.Mmin) < 1e-3) binding.push({ row: 'furnace_min', dual: C.M.Dual });
    }
    const groupShare = Object.fromEntries(p.groups.map(g => [g.key, M > 0 ? p.items.filter(it => g.classes.includes(it.melt_class)).reduce((s, it) => s + it.r * Math.max(0, C[it.v]?.Primal || 0), 0) / M * 100 : 0]));
    return { meltLbs: M, chargeLbs, heelLbs: p.H, cost, groupShare, costPerLbMelt: M ? cost / M : 0, recipe, chem, rows, binding, solveMs: res.ms };
  }

  const itemLabel = (p, rid) => { const it = p.items.find(i => rname(i.id) === rid); return it ? `${it.name} (${it.id})` : rid; };
  function describeRow(row, p) {
    let m;
    if ((m = row.match(/^(min|max)_(.+)$/))) return p.limits[m[2]]?.pinned !== undefined ? `${m[2]} pinned at ${p.limits[m[2]].pinned} wt%` : `${m[2]} ${m[1]} ${p.limits[m[2]]?.[m[1]]} wt%`;
    if ((m = row.match(/^avail_(.+)$/))) return `${itemLabel(p, m[1])} availability`;
    if ((m = row.match(/^cap_(.+)$/))) return `${itemLabel(p, m[1])} max ${p.items.find(i => rname(i.id) === m[1])?.maxPct}% of charge`;
    if ((m = row.match(/^grp(min|max)_(.+)$/))) { const g = p.groups.find(x => x.key === m[2]); return `${g?.label} ${m[1]} ${g?.[m[1]]}% of melt`; }
    if (row === 'furnace_melt') return `Melt weight fixed at ${Math.round(p.Mmax).toLocaleString('en-US')} lbs`;
    if (row === 'furnace_max') return 'Furnace max capacity';
    if (row === 'furnace_min') return 'Furnace min fill';
    return row;
  }

  // Marginal value of relaxing each binding constraint, by re-solve (cost-only model).
  function marginals(highs, p, base) {
    const out = [];
    for (const b of base.binding) {
      let shift = {}, step = '', key = b.row;
      let m;
      if ((m = b.row.match(/^min_(.+)$/))) { shift[b.row] = -0.01; step = 'min −0.01 wt%'; }
      else if ((m = b.row.match(/^max_(.+)$/))) { shift[b.row] = 0.01; step = 'max +0.01 wt%'; }
      else if ((m = b.row.match(/^cap_(.+)$/))) { shift[b.row] = 1; step = 'cap +1 % of charge'; }
      else if ((m = b.row.match(/^grpmin_/))) { shift[b.row] = -1; step = 'min −1 % of melt'; }
      else if ((m = b.row.match(/^grpmax_/))) { shift[b.row] = 1; step = 'max +1 % of melt'; }
      else if ((m = b.row.match(/^avail_(.+)$/))) { shift[b.row] = 1000; step = '+1,000 lbs available'; }
      else continue;
      const res = runHighs(highs, buildLP(p, { mode: 'cost', limitShift: shift }));
      if (!isOptimal(res)) continue;
      const sv = base.cost - res.ObjectiveValue;
      out.push({ row: key, label: describeRow(key, p), step, saving: Math.abs(sv) < 0.5 ? 0 : sv, dual: b.dual });
    }
    return out.sort((a, b) => b.saving - a.saving);
  }

  function elasticDiagnose(highs, p) {
    const diag = {};
    for (const [key, relax] of [['spec', { spec: true }], ['inventory', { inventory: true }]]) {
      const lp = buildLP(p, { mode: 'elastic', relax });
      const res = runHighs(highs, lp);
      if (!isOptimal(res)) { diag[key] = { feasible: false }; continue; }
      const C = res.Columns, M = C.M.Primal, Mref = p.Mmax;
      const v = [];
      for (const [name, col] of Object.entries(C)) {
        if (!/^s[LUBCFG]_?/.test(name) || col.Primal < 1e-6) continue;
        const amt = col.Primal;
        let m;
        if ((m = name.match(/^sL_(.+)$/))) v.push({ kind: 'spec', text: `${m[1]} below ${p.limits[m[1]]?.pinned !== undefined ? 'pinned value' : 'min'} by ${(amt / M * 100).toFixed(3)} wt%`, el: m[1], wtPct: -amt / M * 100 });
        else if ((m = name.match(/^sU_(.+)$/))) v.push({ kind: 'spec', text: `${m[1]} above ${p.limits[m[1]]?.pinned !== undefined ? 'pinned value' : 'max'} by ${(amt / M * 100).toFixed(3)} wt%`, el: m[1], wtPct: amt / M * 100 });
        else if ((m = name.match(/^sB_(.+)$/))) v.push({ kind: 'inventory', text: `Need ${Math.round(amt).toLocaleString('en-US')} lbs more of ${itemLabel(p, m[1])}`, item: m[1], lbs: amt });
        else if ((m = name.match(/^sC_(.+)$/))) v.push({ kind: 'inventory', text: `Raise ${itemLabel(p, m[1])} cap by ${(amt / M * 100).toFixed(1)} % of charge`, item: m[1], lbs: amt });
        else if ((m = name.match(/^sG_grp(min|max)_(.+)$/))) { const g = p.groups.find(x => x.key === m[2]); v.push({ kind: 'inventory', text: `${m[1] === 'min' ? 'Lower' : 'Raise'} the ${g.label.toLowerCase()} ${m[1]} by ${(amt / M * 100).toFixed(1)} % of melt`, group: m[2], pct: amt / M * 100 }); }
        else if (name === 'sF') v.push({ kind: 'inventory', text: `Short of furnace min fill by ${Math.round(amt).toLocaleString('en-US')} lbs`, lbs: amt });
      }
      diag[key] = { feasible: true, violations: v, lp };
    }
    return diag;
  }

  /* solveScenario(highs, scenario, {mode:'cost'|'target', costTolPct, marginals:bool})
   * mode 'target' (default): cheapest first, then closest to target within costTolPct of the cheapest cost.
   */
  // Same scenario with every must-use (min / exact lbs) override removed.
  function withoutMandates(sc) {
    const ov = {};
    for (const [id, o] of Object.entries(sc.overrides || {})) {
      const { lockLbs, minLbs, ...rest } = o; if (Object.keys(rest).length) ov[id] = rest;
    }
    return { ...sc, overrides: ov };
  }
  function solveScenario(highs, sc, opts = {}) {
    const mode = opts.mode || 'target';
    const v = validateScenario(sc);
    if (!v.ok) return { status: 'invalid', validation: v };
    const p = prepare(sc);
    const classConflicts = classLimitConflicts(sc);
    const hasMandates = p.items.some(i => i.mandated);
    const lpCost = buildLP(p, { mode: 'cost' });
    const r1 = runHighs(highs, lpCost);
    let free = null;
    if (hasMandates) {
      const rf = runHighs(highs, buildLP(prepare(withoutMandates(sc)), { mode: 'cost' }));
      free = isOptimal(rf) ? { feasible: true, cost: rf.ObjectiveValue } : { feasible: false };
    }
    const hasPins = Object.keys(sc.chemPins || {}).length > 0;
    const hasTargets = p.els.some(e => p.limits[e].target !== null);
    const tol = (opts.costTolPct ?? 5) / 100;
    // Pins are compared with the unpinned charge solved under the same objective (opts.baseline reuses one, e.g. while dragging).
    let baseline = null;
    if (hasPins) {
      if (opts.baseline) baseline = opts.baseline;
      else {
        const pu = prepare({ ...sc, chemPins: {} });
        const b = objectiveSolve(highs, pu, mode === 'target' && pu.els.some(e => pu.limits[e].target !== null), tol);
        baseline = b ? { feasible: true, cost: b.final.cost, cheapestCost: b.costOnly.cost, result: b.final } : { feasible: false };
      }
    }
    if (!isOptimal(r1)) {
      const diagnosis = elasticDiagnose(highs, p);
      if (hasMandates) diagnosis.mandates = free;
      if (hasPins) diagnosis.pins = baseline.feasible ? { feasible: true, cost: baseline.cheapestCost } : { feasible: false };
      return { status: 'infeasible', highsStatus: r1.Status, validation: v, classConflicts, lp: lpCost, diagnosis, solveMs: r1.ms };
    }
    const costOnly = parse(p, r1);
    let final = costOnly, lpTarget = null, dev = null;
    if (mode === 'target' && hasTargets) {
      // A pinned charge gets no more target-seeking budget than the unpinned charge spent, so its cost
      // change is the pin's own cost and a pin at the current value reproduces the baseline.
      const cap = hasPins && baseline.feasible ? Math.max(costOnly.cost, baseline.cost) : costOnly.cost * (1 + tol);
      lpTarget = buildLP(p, { mode: 'target', costCap: cap + 1e-6 });
      const r2 = runHighs(highs, lpTarget);
      if (isOptimal(r2)) { final = parse(p, r2); final.solveMs += costOnly.solveMs; dev = r2.ObjectiveValue; }
    }
    let pinInfo = null;
    if (hasPins) {
      if (baseline.feasible) {
        // Among charges as cheap (and as close to target) as this one, take the one nearest the baseline.
        const base = Object.fromEntries(baseline.result.recipe.map(r => [p.items.find(i => i.id === r.id)?.v, r.lbs]));
        const rs = runHighs(highs, buildLP(p, { mode: 'stable', base, costCap: final.cost + Math.max(0.01, final.cost * 1e-7), devCap: dev === null ? null : dev * (1 + 1e-6) + 1e-7 }));
        if (isOptimal(rs)) { const ms = final.solveMs; final = parse(p, rs); final.solveMs = ms + rs.ms; }
      }
      pinInfo = pinChanges(sc, final, baseline);
    }
    const out = {
      status: 'optimal', mode: mode === 'target' && hasTargets ? 'target' : 'cost', validation: v, classConflicts,
      result: final, cheapest: costOnly, lp: lpCost, lpTarget,
      // Duals, binding constraints and reduced costs come from the cost-only solve (they explain cost).
      binding: costOnly.binding.map(b => ({ ...b, label: describeRow(b.row, p) })),
      pins: pinInfo,
      mandates: hasMandates ? { items: p.items.filter(i => i.mandated).map(i => i.id), premium: free?.feasible ? Math.max(0, costOnly.cost - free.cost) : null } : null,
      reducedCosts: costOnly.recipe.filter(r => r.lbs < 1e-6 && !r.locked).map(r => ({ id: r.id, name: r.name, reducedCost: r.reducedCost, unitCost: r.unitCost, enterBelow: r.unitCost - r.reducedCost }))
    };
    if (opts.marginals !== false) out.marginals = marginals(highs, p, costOnly);
    return out;
  }

  // Cheapest charge, then (optionally) closest to target within tol of that cost. Null when infeasible.
  function objectiveSolve(highs, p, target, tol) {
    const r1 = runHighs(highs, buildLP(p, { mode: 'cost' }));
    if (!isOptimal(r1)) return null;
    const costOnly = parse(p, r1);
    if (!target) return { costOnly, final: costOnly, dev: null };
    const r2 = runHighs(highs, buildLP(p, { mode: 'target', costCap: costOnly.cost * (1 + tol) + 1e-6 }));
    return isOptimal(r2) ? { costOnly, final: parse(p, r2), dev: r2.ObjectiveValue } : { costOnly, final: costOnly, dev: null };
  }

  /* Pin effect: cost change and per-item lbs / cost change against the unpinned baseline.
   * Item cost changes (Δlbs × $/lb) sum exactly to the total cost change. */
  function pinChanges(sc, final, baseline) {
    const info = { values: { ...sc.chemPins }, unpinnedCost: null, delta: null, deltaPct: null, baseline: baseline.feasible ? baseline : null, changes: [] };
    if (!baseline.feasible) return info;
    const before = Object.fromEntries(baseline.result.recipe.map(r => [r.id, r.lbs]));
    info.unpinnedCost = baseline.cost;
    info.delta = final.cost - baseline.cost;
    info.deltaPct = baseline.cost > 0 ? info.delta / baseline.cost * 100 : null;
    info.changes = final.recipe.map(r => {
      const from = before[r.id] || 0, d = r.lbs - from;
      return { id: r.id, name: r.name, melt_class: r.melt_class, from, to: r.lbs, dLbs: d, dCost: d * r.unitCost };
    }).filter(c => Math.abs(c.dLbs) >= 0.5);
    return info;
  }

  /* Heel chemistry from an alloy spec: target, else mid-range, else half the max, else 0.
   * A stand-in for the previous heat's spectro result, which users can overwrite. */
  function heelChemFromAlloy(alloy, elements) {
    const out = {};
    for (const e of elements) {
      const l = alloy?.limits?.[e] || {};
      const mn = num(l.min), mx = num(l.max), t = num(l.target);
      out[e] = t ?? (mn !== null && mx !== null ? (mn + mx) / 2 : mx !== null ? mx / 2 : mn ?? 0);
    }
    return out;
  }

  const api = { VERSION, CLASS_GROUPS, pinChanges, groupLimits, classLimitConflicts, heelChemFromAlloy, withoutMandates, MELT_CLASSES, validateScenario, prepare, buildLP, solveScenario, describeRow };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AlloyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
