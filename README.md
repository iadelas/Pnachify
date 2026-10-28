# Pnachify

**Turn PS2 cheat codes into a `.pnach` file, on your phone, in about ten seconds.**

### ▶ Try it now: https://pnachify.vercel.app

https://github.com/user-attachments/assets/f0e85497-6dd1-4410-9027-8343798bd8b5

<sub>28 seconds, no sound.</sub>

You found a cheat on a forum. Your game lives on NetherSX2 on your phone. Getting that cheat into the emulator used to mean opening a laptop, finding a converter, converting, then copying files across.

Pnachify deletes the laptop. Paste the codes, tap convert, share the file into your emulator's cheats folder.

Everything runs in your browser. Your codes are never uploaded, and after the first visit the app works offline.

## What you get

- **Any common cheat format** — CodeBreaker, GameShark / Xploder, Action Replay, ARMAX, RAW variants. The format is detected automatically; a picker appears if it isn't sure.
- **A real PNACH file** — `gametitle=` line, one section per cheat, and any codes that failed are marked inside the file instead of silently dropped.
- **A file the emulator accepts** — enter the game CRC and it downloads as `0891B1D0.pnach`, named exactly how PCSX2 and NetherSX2 expect.
- **Phone-native delivery** — Copy, Download, or Share straight to a file manager.

## Under the hood

The original C++ converter, compiled to WebAssembly, running client-side. No server, no accounts, no telemetry. The site is static files plus a single `.wasm` asset.

| Path | What it holds |
|---|---|
| `core/` | C++ converter from [OmniConvertCS](https://github.com/SkillerCMP/OmniConvertCS) |
| `wasm/` | C wrapper and emscripten build script |
| `web/` | Next.js app, the only part Vercel builds |
| `tests/` | WASM-versus-native parity and format-detection tests |

Why WebAssembly and not a rewrite? See `docs/adr/`.

## Run it locally

```bash
cd web
npm install
npm run dev
```

Open http://localhost:3000. Your phone can use the printed network URL on the same Wi-Fi.

## Tests

```bash
ctest --test-dir build -C Release --output-on-failure   # native converter
node --test tests/                                      # WASM parity + detection
cd web && npx playwright test                           # phone-viewport UI
```

The parity suite requires byte-identical output between the native converter and the WASM build for every upstream test vector. Changing `core/` or `wasm/`? Rebuild the artifact with `wasm\build.cmd` (needs [emsdk](https://emscripten.org/docs/getting_started/downloads.html)).

## Known limits

- Untagged encrypted lists can be guessed wrong — the manual picker is there for that.
- Share uses the Android share sheet; Download always works.
- No game-name-to-CRC lookup yet. The CRC is shown in the emulator's game list.

## Credits and license

Built on [OmniConvertCS](https://github.com/SkillerCMP/OmniConvertCS) by SkillerCMP, itself a rewrite of Pyriel's OmniConvert. The conversion logic, format knowledge and test vectors are theirs; this project is the phone-shaped front door.

Licensed under the GNU General Public License v2.0. See [LICENSE](LICENSE).
