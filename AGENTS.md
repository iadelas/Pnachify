# AGENTS.md

## Project

Pnachify is a phone-first website that turns a pasted PS2 cheat code list into a `.pnach` cheat file for PCSX2 and its Android forks (NetherSX2, AetherSX2). The converter core is the GPL v2 C++ library from OmniConvertCS (a rewrite of Pyriel's OmniConvert), compiled to WebAssembly and called from a Next.js app.

Everything runs in the user's browser. There is no backend, no conversion API, and no cheat data ever leaves the device.

## Repository layout

| Path | Contents |
|---|---|
| `core/` | C++ converter, copied from upstream OmniConvertCS. Builds natively for tests and to WASM. |
| `wasm/` | Thin C wrapper plus the emscripten build script. Emits `web/public/omni.wasm` and its loader `web/public/omni.js`. |
| `web/` | Next.js App Router app (TypeScript, Tailwind). The only thing Vercel builds. |
| `tests/` | Node test runner: WASM-vs-CLI parity, round-trip property tests, real-corpus tests. |
| `web/e2e/` | Playwright tests in a mobile viewport. |
| `docs/adr/` | Architecture decisions. |
| `ref_OmniConvertCS/` | Read-only upstream clone, ignored by git. Never edit it. Sync new upstream code by copying files into `core/`. |

## Non-negotiable rules

- No server-side conversion, no analytics, no telemetry, no accounts. The site must work as static files.
- Output is PNACH only. Input format is auto-detected; a manual format picker appears only after detection fails.
- Advanced fields (AR2/GS/ARMAX keys, game ID, region) stay hidden. They do not affect PNACH output.
- GPL v2 must be honoured: keep `LICENSE`, credit OmniConvertCS (SkillerCMP) and Pyriel's original OmniConvert in README and site footer, and keep the deployed source public.
- Commit the compiled `.wasm`. Vercel has no emscripten toolchain, and builds must not require one.
- Never add source code comments. If code needs explaining, rename or split it.

## Prerequisites

- Node.js 20 or newer
- CMake 3.20 or newer and a C++17 compiler (MSVC on Windows)
- emsdk with the latest Emscripten, only needed when rebuilding the WASM artifact

## Setup

```powershell
# Web app dependency install
cd web
npm install

# emsdk (Windows; one time)
git clone https://github.com/emscripten-core/emsdk.git C:\emsdk
C:\emsdk\emsdk install latest
C:\emsdk\emsdk activate latest

# Native converter build used as the test oracle
cmake -S core -B build -DOMNI_BUILD_GUI=OFF -DOMNI_BUILD_TESTS=ON -DOMNI_BUILD_CLI=ON
cmake --build build --config Release
```

## Development workflow

```powershell
# Next.js dev server on http://localhost:3000
cd web
npm run dev

# Rebuild WASM after touching core/ or wasm/ (requires activated emsdk)
wasm\build.cmd
```

The WASM artifact is committed, so the web app runs without emsdk. Rebuild and commit it whenever `core/` or `wasm/` changes, otherwise the deployed site runs stale code.

## Testing

All four layers must pass before a change is committed. Layers 1 and 2 run in CI on every push.

### 1. Native core tests (the ground truth)

```powershell
ctest --test-dir build -C Release --output-on-failure
```

Covers the upstream test suite: crypto, code transposition, parsers, plus the trailing CLI workflow tests. If these fail, the converter logic is broken and nothing downstream is trustworthy.

### 2. WASM-vs-CLI parity (the port test)

```powershell
node --test tests/
```

The parity test loads `web/public/omni.wasm` in Node, runs the native CLI (`build\Release\omniconvert_cli.exe`, overridable with `OMNI_CLI`), and asserts **byte-identical** output for every input in `core/src/tests/vectors/crypto/`. There are 15 files, including a golden pair: `ARMAX[EXPECTED-PNACH-ORIGINAL]-.hack__G.U. Vol 1_ Rebirth.txt` must be produced exactly.

This is the layer that catches port bugs: wrapper plumbing, newline and encoding shifts, argument handling. It does not judge conversion correctness, only that WASM matches native.

### 3. Property and detection tests

Also under `tests/`:

- Round trip: `decrypt(encrypt(raw)) == raw` for every supported crypt. This needs no reference file and can never pass with a wrong-but-consistent implementation.
- Auto-detect: feeding each vector's encrypted file must detect the expected code format. False positives (a plausible-but-wrong crypt) are the failure to hunt for.

When a conversion bug is fixed, add the failing input as a new vector under `core/src/tests/vectors/` and reference it from a test.

### 4. Real-corpus round trip

Harvest a few hundred PNACH files from the PCSX2 community cheats repository into a git-ignored local cache. Convert each to RAW and back, then compare address/value pairs per section. Comments and ordering may normalise; any changed `patch=` line is a failure. This proves the PNACH writer against files users actually run.

### 5. UI tests

```powershell
cd web
npx playwright test
```

Mobile viewport (Pixel-sized). Covers: paste, convert, output contains expected `patch=1,EE,...` lines, download filename equals `<CRC>.pnach`, failed-code banner appears, "Advanced" format picker only shows after detection failure.

### 6. Manual acceptance

Once per release, on a real Android phone: paste one real game's codes, convert, download, place the file in the emulator's cheats folder, confirm the cheat appears and works. No automated test replaces this.

## Code style

- TypeScript strict. App Router with server components by default; `"use client"` only where the WASM module is touched.
- Tailwind utility classes, no CSS files unless a utility cannot express the rule.
- The C wrapper exposes a plain C ABI: no C++ exceptions across the boundary, errors returned as strings.
- Use the vocabulary in `GLOSSARY.md`. Code format names and crypt names must match it exactly.
- The emscripten glue is never imported by Next.js. It is loaded at runtime as a script from `/omni.js`; bundling it breaks Turbopack and webpack.
- One new dependency only when the standard library or an existing dependency genuinely cannot do the job.

## Build and deployment

- Vercel project root directory: `web/`. Framework preset Next.js. No environment variables.
- `npm run build` in `web/` must succeed without emsdk present.
- GitHub Actions runs: native build and ctest, WASM rebuild check (artifact matches the committed one), `node --test tests/`, Playwright.
- Deploy from `main` only.

## Pull request guidelines

- Title: `[core|wasm|web|tests] <what changed>`
- Before pushing: native tests, `node --test tests/`, `npm run lint`, Playwright.
- Never commit without a test that would have caught the bug being fixed.
- If the upstream `core/` is synced, note the upstream commit hash in the PR body.

## Troubleshooting

- WASM fails to load on an old phone: check the browser supports WebAssembly (Chrome 57+, Safari 11+). Do not add a JS fallback converter; show a clear "use a newer browser" message.
- `emsdk` not found when building WASM: run `C:\emsdk\emsdk_env.ps1` in the same shell.
- Parity test cannot find the CLI: build with `-DOMNI_BUILD_CLI=ON` and set `OMNI_CLI` to the executable path.
- Playwright browsers missing in CI: run `npx playwright install --with-deps chromium`.
