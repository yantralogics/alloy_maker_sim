/* sample-data.js — SYNTHETIC sample dataset for the Alloy Maker Simulator.
 * Inventory, prices and chemistries are invented for demonstration; scrap chemistries are typical of each grade.
 * Alloy limits approximate Aluminum Association registrations; verify against your own specs.
 * Zr is held to 0.05 wt% ("others, each") in alloys that do not register it.
 * Units: lbs, $/lb, wt%.
 */
(function (root) {
  const elements = ['Si', 'Fe', 'Cu', 'Mn', 'Mg', 'Cr', 'Zn', 'Ti', 'Zr'];
  const c = (Si, Fe, Cu, Mn, Mg, Cr, Zn, Ti, Zr = 0) => ({ Si, Fe, Cu, Mn, Mg, Cr, Zn, Ti, Zr });

  const inventory = [
    // primary
    { id: 'PRI-1020', name: 'P1020 primary ingot', melt_class: 'primary', comp: c(0.04, 0.08, 0.002, 0.002, 0.001, 0.001, 0.005, 0.005), availableLbs: 500000, cost: 1.32, recovery: 0.995 },
    { id: 'PRI-0303', name: 'P0303 high-purity ingot', melt_class: 'primary', comp: c(0.02, 0.03, 0.001, 0.001, 0.001, 0.001, 0.002, 0.002), availableLbs: 60000, cost: 1.48, recovery: 0.995 },
    { id: 'PRI-0506', name: 'P0506 ingot', melt_class: 'primary', comp: c(0.03, 0.05, 0.002, 0.001, 0.001, 0.001, 0.003, 0.003), availableLbs: 120000, cost: 1.40, recovery: 0.995 },
    { id: 'PRI-1535', name: 'P1535 commercial ingot', melt_class: 'primary', comp: c(0.12, 0.30, 0.005, 0.005, 0.002, 0.002, 0.01, 0.01), availableLbs: 200000, cost: 1.27, recovery: 0.995 },
    { id: 'PRI-SOW', name: 'P1020 sows', melt_class: 'primary', comp: c(0.05, 0.09, 0.003, 0.002, 0.001, 0.001, 0.005, 0.005), availableLbs: 150000, cost: 1.29, recovery: 0.99 },
    // hardeners and alloying additions
    { id: 'HRD-SI50', name: 'Al-50Si hardener', melt_class: 'hardener', comp: c(50, 0.30, 0.01, 0.01, 0, 0, 0.01, 0.01), availableLbs: 30000, cost: 1.65, recovery: 0.98 },
    { id: 'HRD-SIMET', name: 'Silicon metal 553', melt_class: 'hardener', comp: c(98.5, 0.50, 0.01, 0.01, 0, 0, 0, 0.03), availableLbs: 20000, cost: 1.45, recovery: 0.97, elementRecovery: { Si: 0.95 } },
    { id: 'HRD-MG', name: 'Magnesium ingot 99.8', melt_class: 'hardener', comp: c(0.01, 0.02, 0.005, 0.01, 99.8, 0, 0.01, 0), availableLbs: 15000, cost: 2.60, recovery: 0.95, elementRecovery: { Mg: 0.92 } },
    { id: 'HRD-CU50', name: 'Al-50Cu hardener', melt_class: 'hardener', comp: c(0.10, 0.20, 50, 0.01, 0, 0, 0.01, 0), availableLbs: 10000, cost: 3.10, recovery: 0.99 },
    { id: 'HRD-CU33', name: 'Al-33Cu hardener', melt_class: 'hardener', comp: c(0.10, 0.20, 33, 0.01, 0, 0, 0.01, 0), availableLbs: 12000, cost: 2.80, recovery: 0.99 },
    { id: 'HRD-MN25', name: 'Al-25Mn hardener', melt_class: 'hardener', comp: c(0.10, 0.30, 0.01, 25, 0, 0, 0.01, 0), availableLbs: 10000, cost: 2.20, recovery: 0.98 },
    { id: 'HRD-MN75', name: 'Mn 75% tablets', melt_class: 'hardener', comp: c(0.10, 0.50, 0.01, 75, 0, 0, 0.01, 0), availableLbs: 6000, cost: 2.40, recovery: 0.97, elementRecovery: { Mn: 0.95 } },
    { id: 'HRD-CR20', name: 'Al-20Cr hardener', melt_class: 'hardener', comp: c(0.10, 0.25, 0.01, 0.01, 0, 20, 0.01, 0), availableLbs: 4000, cost: 4.80, recovery: 0.98 },
    { id: 'HRD-CR75', name: 'Cr 75% tablets', melt_class: 'hardener', comp: c(0.10, 0.30, 0.01, 0.01, 0, 75, 0.01, 0), availableLbs: 2000, cost: 5.20, recovery: 0.97, elementRecovery: { Cr: 0.95 } },
    { id: 'HRD-ZN', name: 'Zinc SHG ingot', melt_class: 'hardener', comp: c(0, 0.003, 0.002, 0, 0, 0, 99.99, 0), availableLbs: 25000, cost: 1.55, recovery: 0.97, elementRecovery: { Zn: 0.96 } },
    { id: 'HRD-ZR10', name: 'Al-10Zr hardener', melt_class: 'hardener', comp: c(0.10, 0.20, 0.01, 0.01, 0, 0, 0.01, 0, 10), availableLbs: 5000, cost: 4.50, recovery: 0.99 },
    { id: 'HRD-TIB', name: 'Al-5Ti-1B rod', melt_class: 'hardener', comp: c(0.10, 0.15, 0.01, 0.01, 0, 0, 0.01, 5), availableLbs: 3000, cost: 3.40, recovery: 0.99 },
    { id: 'HRD-TI10', name: 'Al-10Ti hardener', melt_class: 'hardener', comp: c(0.10, 0.20, 0.01, 0.01, 0, 0, 0.01, 10), availableLbs: 3000, cost: 2.90, recovery: 0.99 },
    // internal returns (own process scrap, known chemistry)
    { id: 'SCR-6061-INT', name: '6061 internal returns', melt_class: 'internal_scrap', comp: c(0.62, 0.35, 0.28, 0.07, 1.00, 0.20, 0.06, 0.03), availableLbs: 120000, cost: 0.92, recovery: 0.97 },
    { id: 'SCR-6063-INT', name: '6063 internal returns', melt_class: 'internal_scrap', comp: c(0.44, 0.18, 0.03, 0.04, 0.56, 0.02, 0.03, 0.02), availableLbs: 90000, cost: 0.94, recovery: 0.97 },
    { id: 'SCR-6082-INT', name: '6082 internal returns', melt_class: 'internal_scrap', comp: c(1.00, 0.35, 0.06, 0.65, 0.85, 0.10, 0.08, 0.04), availableLbs: 50000, cost: 0.93, recovery: 0.97 },
    { id: 'SCR-3003-INT', name: '3003 internal returns', melt_class: 'internal_scrap', comp: c(0.25, 0.50, 0.12, 1.20, 0.02, 0, 0.05, 0.02), availableLbs: 60000, cost: 0.95, recovery: 0.97 },
    { id: 'SCR-2024-INT', name: '2024 internal returns', melt_class: 'internal_scrap', comp: c(0.20, 0.25, 4.40, 0.60, 1.50, 0.03, 0.10, 0.04), availableLbs: 40000, cost: 1.10, recovery: 0.97 },
    { id: 'SCR-5052-INT', name: '5052 internal returns', melt_class: 'internal_scrap', comp: c(0.12, 0.28, 0.04, 0.05, 2.50, 0.24, 0.04, 0.02), availableLbs: 50000, cost: 0.97, recovery: 0.97, elementRecovery: { Mg: 0.95 } },
    { id: 'SCR-5083-INT', name: '5083 internal returns', melt_class: 'internal_scrap', comp: c(0.15, 0.28, 0.05, 0.70, 4.45, 0.14, 0.08, 0.03), availableLbs: 40000, cost: 0.99, recovery: 0.96, elementRecovery: { Mg: 0.94 } },
    { id: 'SCR-7075-INT', name: '7075 internal returns', melt_class: 'internal_scrap', comp: c(0.10, 0.20, 1.60, 0.05, 2.50, 0.23, 5.60, 0.04, 0.01), availableLbs: 40000, cost: 1.12, recovery: 0.97 },
    { id: 'SCR-7055-INT', name: '7055 internal returns', melt_class: 'internal_scrap', comp: c(0.05, 0.08, 2.30, 0.02, 2.05, 0.02, 8.00, 0.03, 0.12), availableLbs: 30000, cost: 1.18, recovery: 0.97 },
    { id: 'SCR-6061-CHIP', name: '6061 saw chips', melt_class: 'internal_scrap', comp: c(0.62, 0.40, 0.28, 0.08, 0.98, 0.19, 0.07, 0.03), availableLbs: 25000, cost: 0.70, recovery: 0.86, maxPct: 10 },
    { id: 'SCR-DROSS', name: 'Dross concentrate', melt_class: 'internal_scrap', comp: c(0.40, 0.60, 0.15, 0.10, 0.70, 0.05, 0.10, 0.03), availableLbs: 20000, cost: 0.35, recovery: 0.55, maxPct: 5 },
    // purchased scrap
    { id: 'SCR-6063-EXT', name: '6063 extrusion scrap', melt_class: 'purchased_scrap', comp: c(0.42, 0.22, 0.03, 0.04, 0.62, 0.02, 0.04, 0.02), availableLbs: 150000, cost: 1.02, recovery: 0.96 },
    { id: 'SCR-6063-PNT', name: 'Painted 6063 window extrusion', melt_class: 'purchased_scrap', comp: c(0.45, 0.25, 0.05, 0.05, 0.55, 0.03, 0.05, 0.02), availableLbs: 80000, cost: 0.86, recovery: 0.92 },
    { id: 'SCR-6061-EXT', name: '6061 purchased clips', melt_class: 'purchased_scrap', comp: c(0.62, 0.40, 0.27, 0.08, 0.95, 0.18, 0.08, 0.03), availableLbs: 80000, cost: 0.96, recovery: 0.97 },
    { id: 'SCR-MIX6', name: 'Mixed 6xxx scrap', melt_class: 'purchased_scrap', comp: c(0.70, 0.45, 0.25, 0.12, 0.85, 0.08, 0.15, 0.03), availableLbs: 200000, cost: 0.84, recovery: 0.94, maxPct: 40 },
    { id: 'SCR-UBC', name: 'UBC shred', melt_class: 'purchased_scrap', comp: c(0.25, 0.45, 0.15, 0.90, 1.10, 0.02, 0.08, 0.02), availableLbs: 100000, cost: 0.78, recovery: 0.90, maxPct: 30 },
    { id: 'SCR-CANSTK', name: 'New can stock clips (3004/5182)', melt_class: 'purchased_scrap', comp: c(0.22, 0.45, 0.17, 0.95, 1.60, 0.02, 0.07, 0.02), availableLbs: 80000, cost: 0.92, recovery: 0.96 },
    { id: 'SCR-LITHO', name: 'Litho sheet (1050)', melt_class: 'purchased_scrap', comp: c(0.07, 0.30, 0.01, 0.01, 0.01, 0, 0.02, 0.02), availableLbs: 60000, cost: 1.04, recovery: 0.95 },
    { id: 'SCR-EC', name: 'EC wire (1350)', melt_class: 'purchased_scrap', comp: c(0.05, 0.20, 0.005, 0.003, 0.003, 0.002, 0.01, 0.003), availableLbs: 40000, cost: 1.12, recovery: 0.98 },
    { id: 'SCR-FOIL', name: 'Clean foil (1100/8079)', melt_class: 'purchased_scrap', comp: c(0.12, 0.90, 0.05, 0.02, 0.01, 0, 0.03, 0.02), availableLbs: 30000, cost: 0.60, recovery: 0.80, maxPct: 10 },
    { id: 'SCR-SHEET', name: 'Old sheet (mixed 3xxx/5xxx)', melt_class: 'purchased_scrap', comp: c(0.30, 0.55, 0.15, 0.80, 1.00, 0.05, 0.20, 0.03), availableLbs: 100000, cost: 0.80, recovery: 0.92, maxPct: 30 },
    { id: 'SCR-SIDING', name: 'Painted siding (3105)', melt_class: 'purchased_scrap', comp: c(0.30, 0.55, 0.15, 0.45, 0.50, 0.05, 0.20, 0.05), availableLbs: 60000, cost: 0.70, recovery: 0.88, maxPct: 20 },
    { id: 'SCR-RAD', name: 'Aluminum radiators, cleaned', melt_class: 'purchased_scrap', comp: c(0.60, 0.50, 0.15, 1.10, 0.05, 0.02, 1.00, 0.03), availableLbs: 40000, cost: 0.72, recovery: 0.90, maxPct: 15 },
    { id: 'SCR-5XXX', name: 'Mixed 5xxx clips', melt_class: 'purchased_scrap', comp: c(0.20, 0.35, 0.06, 0.35, 3.30, 0.12, 0.08, 0.03), availableLbs: 90000, cost: 0.98, recovery: 0.95, elementRecovery: { Mg: 0.93 } },
    { id: 'SCR-5083-PLT', name: 'Marine 5083 plate scrap', melt_class: 'purchased_scrap', comp: c(0.15, 0.30, 0.05, 0.70, 4.50, 0.12, 0.08, 0.03), availableLbs: 50000, cost: 1.00, recovery: 0.95, elementRecovery: { Mg: 0.93 } },
    { id: 'SCR-2XXX', name: 'Mixed 2xxx aerospace clips', melt_class: 'purchased_scrap', comp: c(0.25, 0.30, 4.30, 0.60, 1.40, 0.05, 0.15, 0.05, 0.02), availableLbs: 60000, cost: 1.05, recovery: 0.96 },
    { id: 'SCR-7XXX', name: 'Mixed 7xxx aerospace clips (7050/7075)', melt_class: 'purchased_scrap', comp: c(0.10, 0.18, 2.00, 0.05, 2.30, 0.10, 6.50, 0.04, 0.08), availableLbs: 60000, cost: 1.10, recovery: 0.96 },
    { id: 'SCR-A356-WHL', name: 'A356 wheel scrap', melt_class: 'purchased_scrap', comp: c(7.0, 0.12, 0.02, 0.02, 0.35, 0, 0.03, 0.12), availableLbs: 80000, cost: 1.08, recovery: 0.97 },
    { id: 'SCR-OLDCAST', name: 'Mixed old cast (A380/A319)', melt_class: 'purchased_scrap', comp: c(8.50, 1.00, 3.20, 0.30, 0.25, 0.05, 1.80, 0.05), availableLbs: 80000, cost: 0.62, recovery: 0.88, maxPct: 25 },
    { id: 'SCR-PISTON', name: 'Pistons (4032)', melt_class: 'purchased_scrap', comp: c(12.0, 0.60, 0.90, 0.05, 1.00, 0.05, 0.10, 0.05), availableLbs: 30000, cost: 0.70, recovery: 0.90, maxPct: 15 },
    { id: 'SCR-SHRED', name: 'Auto shred (mixed wrought/cast)', melt_class: 'purchased_scrap', comp: c(2.50, 0.80, 1.00, 0.30, 0.60, 0.05, 0.60, 0.04), availableLbs: 80000, cost: 0.68, recovery: 0.88, maxPct: 15 },
    { id: 'SCR-TURN', name: 'Mixed turnings', melt_class: 'purchased_scrap', comp: c(0.80, 0.90, 1.00, 0.30, 0.80, 0.08, 0.80, 0.04, 0.02), availableLbs: 40000, cost: 0.55, recovery: 0.82, maxPct: 10 }
  ];

  const L = (min, max, target) => ({ min: min ?? null, max: max ?? null, target: target ?? null });
  const ZR = L(null, 0.05); // others, each
  const alloys = [
    { code: '2024', name: 'AA 2024', limits: { Si: L(null, 0.50), Fe: L(null, 0.50), Cu: L(3.8, 4.9, 4.4), Mn: L(0.30, 0.90, 0.60), Mg: L(1.2, 1.8, 1.5), Cr: L(null, 0.10), Zn: L(null, 0.25), Ti: L(null, 0.15), Zr: ZR } },
    { code: '3003', name: 'AA 3003', limits: { Si: L(null, 0.60), Fe: L(null, 0.70), Cu: L(0.05, 0.20, 0.12), Mn: L(1.00, 1.50, 1.20), Zn: L(null, 0.10), Zr: ZR } },
    { code: '5052', name: 'AA 5052', limits: { Si: L(null, 0.25), Fe: L(null, 0.40), Cu: L(null, 0.10), Mn: L(null, 0.10), Mg: L(2.2, 2.8, 2.5), Cr: L(0.15, 0.35, 0.25), Zn: L(null, 0.10), Zr: ZR } },
    { code: '5083', name: 'AA 5083', limits: { Si: L(null, 0.40), Fe: L(null, 0.40), Cu: L(null, 0.10), Mn: L(0.40, 1.0, 0.70), Mg: L(4.0, 4.9, 4.45), Cr: L(0.05, 0.25, 0.15), Zn: L(null, 0.25), Ti: L(null, 0.15), Zr: ZR } },
    { code: '6061', name: 'AA 6061', limits: { Si: L(0.40, 0.80, 0.62), Fe: L(null, 0.70), Cu: L(0.15, 0.40, 0.28), Mn: L(null, 0.15), Mg: L(0.80, 1.20, 1.00), Cr: L(0.04, 0.35, 0.20), Zn: L(null, 0.25), Ti: L(null, 0.15), Zr: ZR } },
    { code: '6063', name: 'AA 6063', limits: { Si: L(0.20, 0.60, 0.45), Fe: L(null, 0.35), Cu: L(null, 0.10), Mn: L(null, 0.10), Mg: L(0.45, 0.90, 0.55), Cr: L(null, 0.10), Zn: L(null, 0.10), Ti: L(null, 0.10), Zr: ZR } },
    { code: '6082', name: 'AA 6082', limits: { Si: L(0.7, 1.3, 1.0), Fe: L(null, 0.50), Cu: L(null, 0.10), Mn: L(0.40, 1.0, 0.70), Mg: L(0.6, 1.2, 0.9), Cr: L(null, 0.25), Zn: L(null, 0.20), Ti: L(null, 0.10), Zr: ZR } },
    { code: '7055', name: 'AA 7055', limits: { Si: L(null, 0.10), Fe: L(null, 0.15), Cu: L(2.0, 2.6, 2.3), Mn: L(null, 0.05), Mg: L(1.8, 2.3, 2.05), Cr: L(null, 0.04), Zn: L(7.6, 8.4, 8.0), Ti: L(null, 0.06), Zr: L(0.08, 0.25, 0.12) } },
    { code: '7075', name: 'AA 7075', limits: { Si: L(null, 0.40), Fe: L(null, 0.50), Cu: L(1.2, 2.0, 1.6), Mn: L(null, 0.30), Mg: L(2.1, 2.9, 2.5), Cr: L(0.18, 0.28, 0.23), Zn: L(5.1, 6.1, 5.6), Ti: L(null, 0.20), Zr: ZR } },
    { code: 'A356', name: 'A356.0', limits: { Si: L(6.50, 7.50, 7.00), Fe: L(null, 0.20), Cu: L(null, 0.20), Mn: L(null, 0.10), Mg: L(0.25, 0.45, 0.35), Zn: L(null, 0.10), Ti: L(null, 0.20, 0.12), Zr: ZR } }
  ];

  const furnaces = [
    { id: 'F1', name: 'Reverb furnace 1', minLbs: 180000, maxLbs: 200000, heelLbs: 20000, meltLbs: 180000 }
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
