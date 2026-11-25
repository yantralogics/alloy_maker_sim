# Alloy Maker Simulator: LP Solver Core

Least-cost aluminum furnace charge, solved in the browser with [HiGHS](https://highs.dev) via [highs-js](https://github.com/lovasoa/highs-js) 1.15.2 (WebAssembly). Units: lbs, $/lb, wt%.

Static site: no server and no build step. Sample inventory, prices and furnace data are synthetic.

## Files
| File | Purpose |
| --- | --- |
| `index.html` | The app page |
| `alloy-core.js` | LP builder, solver wrapper, diagnostics (shared core) |
| `sample-data.js` | Synthetic inventory, alloy specs, furnace |
| `alloy-tests.js` | Test suite (runs in the page and in Node) |
| `highs.js`, `highs.wasm` | HiGHS solver (MIT licensed), copied from the `highs` npm package |
| `.nojekyll` | Tells GitHub Pages to serve files as-is |

## Run locally
The page loads `highs.wasm` with fetch, so it must be served over HTTP; opening `index.html` directly from disk will not work.

    python3 -m http.server 8000    # then open http://localhost:8000

## Tests

    npm install && npm test

## Publish on GitHub Pages
1. Create a repository and push these files to the `main` branch (root of the repo).
2. Repository **Settings → Pages → Build and deployment**: Source *Deploy from a branch*, Branch `main`, folder `/ (root)`.
3. The site appears at `https://<user>.github.io/<repo>/` within a minute or two.
