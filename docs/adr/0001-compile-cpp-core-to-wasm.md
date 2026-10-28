# Compile the C++ converter core to WebAssembly

The converter is roughly 13,000 lines of C++ — crypto tables, format parsers and code transposition — and we need it running inside a Next.js app on Vercel. We compile that core to WebAssembly and call it from the browser instead of rewriting it in TypeScript or running the native CLI on a server. A TypeScript rewrite would take weeks and puts the crypto tables at risk of subtle transcription bugs, which is precisely the code that must stay byte-for-byte correct. A server-side CLI cannot deploy to Vercel, which does not run arbitrary native binaries.

**Considered options**: TypeScript rewrite (weeks of work, high bug risk); server-side native CLI (needs a container host instead of Vercel).

**Consequences**: behaviour matches the desktop tool exactly; conversion runs on the user's device, so cheat codes never leave the phone; the compiled `.wasm` artifact is committed because Vercel has no Emscripten toolchain; the build stays GPL v2, so its source must remain public.
