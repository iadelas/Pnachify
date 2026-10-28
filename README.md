# Pnachify

Turn PS2 cheat codes into a `.pnach` file, in your phone browser.

Pnachify is a web version of [OmniConvertCS](https://github.com/SkillerCMP/OmniConvertCS). Paste a cheat list from a forum, a cheat site, or a device export; pick the game; get a PNACH file ready for PCSX2 and its Android forks (NetherSX2, AetherSX2). No install, no laptop, no file transfer to your phone.

Everything runs in your browser. Cheat codes are never uploaded.

## Features

- **Auto-detects the code format** — CodeBreaker, GameShark / Xploder, Action Replay, ARMAX and the RAW variants. A manual picker appears if detection fails.
- **PNACH output** with a real `gametitle=` line, one `[Section]` per cheat, and failed codes marked inside the file.
- **Phone-first** — paste, convert, then Download or Share straight to a file manager.
- **CRC-named downloads** — enter the game CRC and the file is saved as `0891B1D0.pnach`, ready for the emulator's cheats folder.
- **Works offline after first load** — the converter is a single WASM file cached by the browser.

## Quick start

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000.

Your phone can use the network URL printed by Next.js while it is on the same Wi-Fi.

## How it works

| Path | What it holds |
|---|---|
| `core/` | The C++ converter from OmniConvertCS. Crypto, parsers, code transposition. |
| `wasm/` | A small C wrapper and the emscripten build script. Produces `web/public/omni.wasm`. |
| `web/` | The Next.js app (App Router, TypeScript, Tailwind). The only part Vercel builds. |
| `tests/` | WASM-versus-native parity tests, round trips and format detection tests. |
| `web/e2e/` | Playwright tests in a phone viewport. |

The C++ core is compiled to WebAssembly and called from the browser. There is no backend: the site is static files plus one `.wasm` asset, so conversion is instant and private, and hosting is free.

## Supported formats

Input (auto-detected or chosen manually): RAW, MAXRAW, ARAW, CRAW, GS12RAW, GRAW, AR1, AR2, ARMAX, CB, CB7_COMMON, GS3, GS5, SMC, XP13, XP4, XP5, PNACH.

Output: PNACH only, by design. See `docs/adr/` for the reasoning.

## Testing

```bash
# Native converter tests (test oracle)
cmake -S core -B build -DOMNI_BUILD_GUI=OFF -DOMNI_BUILD_TESTS=ON -DOMNI_BUILD_CLI=ON
cmake --build build --config Release
ctest --test-dir build -C Release --output-on-failure

# WASM parity, round trips and detection (repo root)
node --test tests/

# UI tests
cd web
npx playwright test
```

The parity suite converts every upstream test vector through both the native CLI and the WASM build and requires identical bytes. If you change `core/` or `wasm/`, rebuild the artifact and rerun it:

```bash
wasm\build.cmd
```

Rebuilding requires [emsdk](https://emscripten.org/docs/getting_started/downloads.html); running the site does not.

## Deployment

Static hosting. On Vercel, set the project root directory to `web/` and deploy. The committed `omni.wasm` means the build needs no C++ toolchain.

## Known limits

- Untagged encrypted code lists can be guessed wrong. Use the manual format picker.
- The Share button uses the Android share sheet; Download always works.
- CRC lookup by game name is not built in yet. The CRC is shown in the emulator's game list.

## Credits and license

Pnachify is built on [OmniConvertCS](https://github.com/SkillerCMP/OmniConvertCS) by SkillerCMP, which is a C++ rewrite of Pyriel's OmniConvert. Both projects deserve the credit for the conversion logic, format knowledge and test vectors.

Licensed under the GNU General Public License v2.0. See [LICENSE](LICENSE).
