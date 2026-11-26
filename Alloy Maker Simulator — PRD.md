# Alloy Maker Simulator — PRD

Nov 25, 2026 · @Param · Status: Draft for review

## Overview and goals

Alloy Maker Simulator is a browser-based tool that computes the least-cost furnace charge for an aluminum alloy and lets metallurgists and planners explore what-if scenarios around it. It pairs a linear programming (LP) charge solver with a simulator UI and diagnostic visualizations, so users can see not only what to charge but why.

**Problem.** Charge calculation today depends on an LP solver that works as a black box. When a result looks wrong, comes back infeasible, or costs more than expected, users have no easy way to see which constraint is binding, which element drives cost, or how a different scrap mix would change the answer. Experimenting means re-running the solver by hand with edited inputs.

**Goals**

1. Produce a least-cost, in-spec charge recipe from current inventory, a target alloy spec, and furnace constraints.
2. Let users build and compare what-if scenarios (price changes, inventory shortfalls, tighter specs, more scrap) side by side.
3. Make solver results explainable: binding constraints, shadow prices, element-by-element contribution, and clear reasons for infeasibility.
4. Keep inventory items and target alloy specs as editable, reusable reference data shared across the tool.

**Non-goals (v1)**

- Live integration with ERP, MES or spectrometer systems (v1 uses uploaded or hand-entered data).
- Melt-loss physics, thermodynamics or furnace-temperature modelling beyond simple recovery factors.
- Multi-furnace or multi-day production scheduling.
- Automatic purchase ordering.

## Users and key stories

Three roles use the tool; the casthouse metallurgist is the primary user for v1.

| Role | What they need | Typical session |
| --- | --- | --- |
| Casthouse metallurgist | A correct, in-spec charge for the next heat, and confidence in why | Pick target alloy, check inventory, solve, adjust, export recipe |
| Production / materials planner | Cost impact of inventory and price changes; how much scrap can be absorbed | Build 3–5 scenarios, compare cost per tonne and scrap usage |
| Process / data engineer | Diagnose odd or infeasible solver results | Inspect binding constraints, shadow prices, element balance |

**User stories**

- As a metallurgist, I select alloy 6061 and a 40 t furnace and get a charge recipe with cost, predicted chemistry and spec margins in under 5 seconds.
- As a metallurgist, I lock a quantity ("use all 3 t of this returns scrap") and re-solve.
- As a planner, I clone a baseline scenario, raise the price of Si hardener by 15%, and see the cost delta and recipe change side by side.
- As a planner, I see how much more of a scrap grade I could use before an element goes out of spec.
- As an engineer, when a solve is infeasible, I see which element limits or inventory limits conflict and a suggested relaxation.
- As any user, I edit inventory and alloy specs in a table and the solver uses the changes immediately.

*Example figures above (6061, 200,000lbs **, 15%) are illustrative; real values come from the foundry's data.*

## Domain model

The solver works on four entities: inventory items, target alloys, the furnace, and scenarios that bundle them. Compositions are in weight percent (wt%) for a fixed element list, configurable per site (default: Si, Fe, Cu, Mn, Mg, Cr, Ni, Zn, Ti, Pb, Sn, others, Al balance).

**Inventory item** — any material that can go into the charge.

| Field | Type | Notes |
| --- | --- | --- |
| id, name | text | e.g. "P1020 ingot", "Al-50Si hardener", "6xxx extrusion scrap" |
| melt\_class | enum | primary, hardener, internal\_scrap, purchased\_scrap |
| composition | wt% per element | Nominal value; optional min/max or std dev for scrap uncertainty |
| available qty | lbs | On-hand; optional on-order qty and date |
| unit cost | $/lbs | Landed cost |
| recovery | % | Metal yield after melt loss; per element override optional (e.g. Mg loss) |
| usage limits | lbs or % of charge | Min / max per heat; e.g. cap a dirty scrap at 15% |

**Target alloy** — the spec being made.

| Field | Type | Notes |
| --- | --- | --- |
| alloy code | text | e.g. AA 6061, A356 |
| chem limits | wt% per element | We will have minimum , maximum and target. Its possible to have some elements to have a target while others are strictly specified by min and max. |

**Furnace** — capacity in lbs (min fill and max), heel mass and heel chemistry carried over from the previous heat, max number of distinct items per charge.

**Scenario** — a named, versioned bundle: alloy + furnace + inventory snapshot + overrides (prices, availability, locked quantities, constraint tweaks) + solver result. Scenarios can be cloned and compared.

## LP charge solver

The solver chooses how many tonnes of each inventory item to charge so the melt meets the alloy's chemistry limits at minimum cost. All constraints stay linear because element limits are written against the total melt mass, not as ratios.

**Decision variables:** x\_i = tonnes of item i charged (x\_i ≥ 0). Given: cost c\_i, recovery r\_i, composition a\_ie (wt% of element e in item i), heel mass H with composition h\_e.

Objective — minimize charge cost:

```latex
\min \sum_i c_i \, x_i
```

Melt mass and chemistry limits, for every element e:

```latex
M = H + \sum_i r_i \, x_i
```

```latex
L_e \, M \;\le\; H h_e + \sum_i r_i \, a_{ie} \, x_i \;\le\; U_e \, M
```

**Other constraints**

- Furnace capacity: M\_min ≤ M ≤ M\_max (or M fixed to a target batch size).
- Inventory: x\_i ≤ available\_i.
- Usage limits: min\_i ≤ x\_i ≤ max\_i, and percentage caps written as x\_i ≤ p\_i · M.
- User locks: x\_i fixed to a given value.
- Optional (v2, needs a MILP): max number of distinct items, minimum lot size if used.

**Outputs**

- Recipe: x\_i per item, total cost, cost per tonne of melt.
- Predicted chemistry per element, with margin to min/max and to aim.
- Binding constraints and shadow prices (cost of tightening or relaxing each limit by one unit).
- Reduced costs per item (how much cheaper an unused item would need to be to enter the charge).
- Objective ranging: price range over which the recipe stays the same.

**Infeasibility handling.** When no solution exists, the solver re-runs an elastic version that adds penalized slack variables to every element and inventory constraint. It reports the smallest set of violations (e.g. "Fe exceeds max by 0.04 wt% with current scrap") and suggests relaxations: buy more primary, raise a cap, or accept a wider internal limit.

**target****-seeking .** A secondary objective adds a small penalty on deviation from aim, so among near-equal-cost recipes the solver picks the one closest to aim. The default mode should be cheapest + close to target.&#32;

**Implementation.** Solver runs in the browser for v1 so artifacts stay self-contained: [javascript-lp-solver](https://github.com/JWally/jsLPSolver) or HiGHS compiled to WebAssembly (highs-js). HiGHS is preferred because it returns duals and supports MILP for v2. Target: under 1 s for 50 items and 15 elements.

## Project artifacts

The project splits into four artifacts: this PRD, an editable reference-data workbook, a standalone solver core, and the simulator app that uses both.

&#91;embedded content: project artifacts · data, solver core, simulator app\]

The solver is built and tested on its own first, then reused unchanged inside the simulator app.

| # | Artifact | Form | Contents |
| --- | --- | --- | --- |
| A1 | Alloy Maker Simulator — PRD | Doc | This document |
| A2 | Inventory and Alloy Library | Sheet | Tabs for inventory items, alloy specs, furnaces; synthetic sample data; CSV export |
| A3 | LP Solver Core | HTML page | Solver module, data schemas, test harness showing recipe, duals and infeasibility cases on sample data |
| A4 | Alloy Charge Simulator | HTML app | Charge Simulator, Scenario Lab, Diagnostics, data editors; embeds A3's solver; imports A2 data |

Artifacts don't share live state, so data moves between them by CSV/JSON import, and A3's solver code is copied into A4 when A4 is built.

## Technical stack

v1 runs entirely in the browser as self-contained claude.ai artifacts: no server, no build step, and the solver ships inside the page as WebAssembly.

| Layer | Choice | Why / notes |
| --- | --- | --- |
| Hosting | Static HTML artifacts on claude.ai | Private by default, shareable by link; pages may only load approved CDNs and their own files |
| LP / MILP solver | HiGHS via [highs-js](https://github.com/lovasoa/highs-js) 1.15.2 (WASM), shipped as the artifact's own files | Open-source, fast, returns primal values, duals and reduced costs; MILP ready for v2 |
| Solver runtime | Web Worker | Keeps the UI responsive during parameter sweeps (many solves) |
| Model format | Scenario JSON → CPLEX LP text → HiGHS | LP text is human-readable, so the generated model can be shown in Diagnostics |
| Shared core module | `alloy-core.js` (plain JavaScript) | Schemas, validation, LP builder, result parser; built and tested in A3, copied unchanged into A4 |
| UI | Vanilla JavaScript + HTML/CSS, no framework | Small app, no build tooling; works inside the artifact sandbox |
| Charts | Hand-written SVG for gauges, waterfalls, margins; [D3](https://d3js.org) v7 from cdnjs for sweeps and heatmap | Full control over metallurgy-specific visuals |
| CSV import | [PapaParse](https://www.papaparse.com) from cdnjs | Robust parsing of ERP / spreadsheet exports |
| Reference data | A2 Sheet (editable grid, downloads as .xlsx/CSV) | Planners edit inventory and specs where they already work |
| Scenario storage | Browser localStorage in v1 | Per user and per browser only; a shared team store is an open question |
| Testing | Node.js + same `highs` npm package for solver unit tests; in-page test harness in A3 | Same solver binary in tests and in the browser |

**Units:** mass in lbs, cost in $/lb, composition in wt%.

**Sandbox limits to design around:** pages cannot start file downloads or reach external APIs. Exports are therefore Copy-to-clipboard (CSV / JSON), and data comes in by file upload or paste.

## Simulator UI

The UI has three working views — Charge Simulator, Scenario Lab and Diagnostics — over shared reference data. Every view reads from the same scenario object, so a change in one is reflected in the others.

### 1. Charge Simulator (single heat)

- **Setup panel:** pick target alloy, furnace and batch size. Melter heel: choose the heel alloy and heel weight (lbs); heel chemistry is pre-filled from that alloy's target or mid-spec and can be overwritten with the previous heat's spectro result.
- **Inventory grid:** each item with availability, cost, composition; per-row Use control to pre-assign must-use items (at least N lbs, or exactly N lbs) or exclude an item. The result shows the extra cost of the must-use items, and an infeasible result says whether they are the cause.
- **Solve** button with mode toggle (cheapest / cheapest then closest to aim).
- **Result panel:** recipe table (t, % of charge, cost), total and $/t, and a chemistry gauge per element showing min, aim, max and predicted value. Users can drag an element's predicted value (or use arrow keys) to pin it at a specific wt%; the charge re-solves with that element held exactly there and shows the cost impact against the unpinned cheapest charge. Pins can be cleared individually or all at once, and an unreachable pin is reported as the cause of infeasibility.
- **Manual mode:** user types quantities without solving; chemistry and cost update live, with out-of-spec elements flagged. Useful for checking an operator's proposed charge.
- Export recipe as CSV / printable charge sheet.

### 2. Scenario Lab (what-if)

- Clone the current scenario and apply overrides: price change (% or absolute), availability change, spec tightening, new scrap grade, larger/smaller batch.
- **Comparison view:** 2–4 scenarios side by side — cost/t, recipe differences, chemistry margins.
- **Parameter sweep:** vary one input over a range (e.g. scrap price $1,200–$2,000/t, or scrap cap 0–60%) and plot cost/t and recipe mix against it, showing where the recipe switches.
- **Scrap absorption:** maximum tonnes of a chosen scrap the charge can take while staying in spec, and which element stops it.

### 3. Diagnostics (troubleshooting)

| Visualization | Question it answers |
| --- | --- |
| Element balance waterfall per element | Which items contribute how much Si, Fe, Cu… to the melt |
| Spec margin chart (bullet / gauge per element) | Which elements are near a limit; which are binding |
| Shadow price bar chart | Which constraint is costing the most; value of relaxing it by 0.01 wt% or 1 t |
| Reduced cost table | Why an item was not used, and the price at which it would be |
| Cost breakdown (stacked bar by item / category) | Where the money goes: primary vs hardener vs scrap |
| Sensitivity / ranging chart | How far a price can move before the recipe changes |
| Infeasibility report | Conflicting constraints and the smallest relaxations that fix them |
| Composition heatmap (items × elements) | Which inventory items are "dirty" in a given element |

### Reference data editors

- **Inventory table:** add, edit, import CSV, export; validation that compositions sum to about 100% and costs are positive.
- **Alloy spec library:** spec ranges, aims and internal limits per alloy; import from CSV.
- **Furnace setup:** capacity, heel defaults.

## Requirements, phasing and open questions

**Non-functional requirements**

- Solve time under 1 s for 50 items × 15 elements in the browser; UI updates live in manual mode.
- Units shown everywhere (t, wt%, $/t); configurable currency and mass unit.
- Every result reproducible: a scenario stores inputs, solver version and result together.
- Data stays in the user's browser / artifact storage for v1; no external calls.
- Sample dataset (synthetic, clearly labelled) ships with the tool so it is usable before real data is loaded.

**Phasing**

1. **Phase 1 — Data + solver core:** schemas, sample inventory and alloy library, LP formulation in HiGHS, unit tests against hand-checked cases.
2. **Phase 2 — Charge Simulator:** setup, inventory grid, solve, result panel, manual mode, export.
3. **Phase 3 — Diagnostics:** element balance, spec margins, shadow prices, reduced costs, infeasibility report.
4. **Phase 4 — Scenario Lab:** clone/compare, parameter sweep, scrap absorption.
5. **Phase 5 (v2):** MILP features (item count, minimum lots), composition uncertainty for scrap, multi-heat planning.

**Success metrics**

- Solver recipe matches the existing production solver within 0.5% cost on 20 historical heats.
- A metallurgist can go from alloy selection to exported recipe in under 2 minutes.
- Every infeasible case shows at least one actionable relaxation.

**Open questions**

- [ ] Which elements and which alloys should the v1 library cover?
- [ ] Is the existing solver's formulation available, so we can match it (e.g. aim penalties, recovery handling)?
- [ ] Are recoveries per item, per element, or both?
- [ ] How is heel chemistry known today — spectro of the previous heat or an estimate?
- [ ] Should scrap composition uncertainty be modelled in v1 (e.g. solve to a safety margin inside spec)?
- [ ] Where will real data come from — CSV exports from ERP/LIMS, or manual entry?
- [ ] Is a single shared scenario store needed for teams, or is per-user storage enough for v1?
