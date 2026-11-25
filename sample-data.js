/* sample-data.js — SYNTHETIC sample dataset for the Alloy Maker Simulator.
 * Inventory, prices and chemistries are invented for demonstration.
 * Alloy limits approximate Aluminum Association registrations; verify against your own specs.
 * Units: lbs, $/lb, wt%.
 */
(function (root) {
  const elements = ['Si', 'Fe', 'Cu', 'Mn', 'Mg', 'Cr', 'Zn', 'Ti'];
  const c = (Si, Fe, Cu, Mn, Mg, Cr, Zn, Ti) => ({ Si, Fe, Cu, Mn, Mg, Cr, Zn, Ti });

  const inventory = [
    { id: 'PRI-1020', name: 'P1020 primary ingot', melt_class: 'primary', comp: c(0.04, 0.08, 0.002, 0.002, 0.001, 0.001, 0.005, 0.005), availableLbs: 500000, cost: 1.32, recovery: 0.995 },
    { id: 'PRI-0303', name: 'P0303 high-purity ingot', melt_class: 'primary', comp: c(0.02, 0.03, 0.001, 0.001, 0.001, 0.001, 0.002, 0.002), availableLbs: 60000, cost: 1.48, recovery: 0.995 },
    { id: 'HRD-SI50', name: 'Al-50Si hardener', melt_class: 'hardener', comp: c(50, 0.30, 0.01, 0.01, 0, 0, 0.01, 0.01), availableLbs: 30000, cost: 1.65, recovery: 0.98 },
    { id: 'HRD-MG', name: 'Magnesium ingot 99.8', melt_class: 'hardener', comp: c(0.01, 0.02, 0.005, 0.01, 99.8, 0, 0.01, 0), availableLbs: 15000, cost: 2.60, recovery: 0.95, elementRecovery: { Mg: 0.92 } },
    { id: 'HRD-CU50', name: 'Al-50Cu hardener', melt_class: 'hardener', comp: c(0.10, 0.20, 50, 0.01, 0, 0, 0.01, 0), availableLbs: 10000, cost: 3.10, recovery: 0.99 },
    { id: 'HRD-MN25', name: 'Al-25Mn hardener', melt_class: 'hardener', comp: c(0.10, 0.30, 0.01, 25, 0, 0, 0.01, 0), availableLbs: 10000, cost: 2.20, recovery: 0.98 },
    { id: 'HRD-CR20', name: 'Al-20Cr hardener', melt_class: 'hardener', comp: c(0.10, 0.25, 0.01, 0.01, 0, 20, 0.01, 0), availableLbs: 4000, cost: 4.80, recovery: 0.98 },
    { id: 'HRD-TIB', name: 'Al-5Ti-1B rod', melt_class: 'hardener', comp: c(0.10, 0.15, 0.01, 0.01, 0, 0, 0.01, 5), availableLbs: 3000, cost: 3.40, recovery: 0.99 },
    { id: 'SCR-6061-INT', name: '6061 internal returns', melt_class: 'internal_scrap', comp: c(0.62, 0.35, 0.28, 0.07, 1.00, 0.20, 0.06, 0.03), availableLbs: 120000, cost: 0.92, recovery: 0.97 },
    { id: 'SCR-6063-EXT', name: '6063 extrusion scrap', melt_class: 'purchased_scrap', comp: c(0.42, 0.22, 0.03, 0.04, 0.62, 0.02, 0.04, 0.02), availableLbs: 150000, cost: 1.02, recovery: 0.96 },
    { id: 'SCR-MIX6', name: 'Mixed 6xxx scrap', melt_class: 'purchased_scrap', comp: c(0.70, 0.45, 0.25, 0.12, 0.85, 0.08, 0.15, 0.03), availableLbs: 200000, cost: 0.84, recovery: 0.94, maxPct: 40 },
    { id: 'SCR-UBC', name: 'UBC shred', melt_class: 'purchased_scrap', comp: c(0.25, 0.45, 0.15, 0.90, 1.10, 0.02, 0.08, 0.02), availableLbs: 100000, cost: 0.78, recovery: 0.90, maxPct: 30 },
    { id: 'SCR-A356-WHL', name: 'A356 wheel scrap', melt_class: 'purchased_scrap', comp: c(7.0, 0.12, 0.02, 0.02, 0.35, 0, 0.03, 0.12), availableLbs: 80000, cost: 1.08, recovery: 0.97 },
    { id: 'SCR-3003-INT', name: '3003 internal returns', melt_class: 'internal_scrap', comp: c(0.25, 0.50, 0.12, 1.20, 0.02, 0, 0.05, 0.02), availableLbs: 60000, cost: 0.95, recovery: 0.97 }
  ];

  const L = (min, max, target) => ({ min: min ?? null, max: max ?? null, target: target ?? null });
  const alloys = [
    { code: '6061', name: 'AA 6061', limits: { Si: L(0.40, 0.80, 0.62), Fe: L(null, 0.70), Cu: L(0.15, 0.40, 0.28), Mn: L(null, 0.15), Mg: L(0.80, 1.20, 1.00), Cr: L(0.04, 0.35, 0.20), Zn: L(null, 0.25), Ti: L(null, 0.15) } },
    { code: '6063', name: 'AA 6063', limits: { Si: L(0.20, 0.60, 0.45), Fe: L(null, 0.35), Cu: L(null, 0.10), Mn: L(null, 0.10), Mg: L(0.45, 0.90, 0.55), Cr: L(null, 0.10), Zn: L(null, 0.10), Ti: L(null, 0.10) } },
    { code: 'A356', name: 'A356.0', limits: { Si: L(6.50, 7.50, 7.00), Fe: L(null, 0.20), Cu: L(null, 0.20), Mn: L(null, 0.10), Mg: L(0.25, 0.45, 0.35), Zn: L(null, 0.10), Ti: L(null, 0.20, 0.12) } },
    { code: '3003', name: 'AA 3003', limits: { Si: L(null, 0.60), Fe: L(null, 0.70), Cu: L(0.05, 0.20, 0.12), Mn: L(1.00, 1.50, 1.20), Zn: L(null, 0.10) } }
  ];

  const furnaces = [
    { id: 'F1', name: 'Reverb furnace 1', minLbs: 180000, maxLbs: 200000, heelLbs: 20000 }
  ];

  // Heel chemistry defaults to the previous heat; here, a 6063 heel.
  const heelComp = c(0.45, 0.20, 0.02, 0.03, 0.55, 0.01, 0.03, 0.02);

  function scenario(alloyCode = '6061', extra = {}) {
    const f = furnaces[0];
    return Object.assign({
      name: `${alloyCode} baseline`,
      elements: elements.slice(),
      inventory: JSON.parse(JSON.stringify(inventory)),
      alloy: JSON.parse(JSON.stringify(alloys.find(a => a.code === alloyCode))),
      furnace: { ...f, heelAlloy: '6063', heelComp: { ...heelComp } },
      overrides: {}
    }, extra);
  }

  const api = { elements, inventory, alloys, furnaces, heelComp, scenario };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AlloySample = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
