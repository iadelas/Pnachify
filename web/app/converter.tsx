"use client";

import { useEffect, useState } from "react";
import {
  convertFrom,
  countFailedCodes,
  detectAndConvert,
  hasPatchLines,
  loadOmni,
  outputFormats,
  pnachFileName,
  withGameTitle,
} from "@/lib/omni";

const gameNameKey = "pnachify.gameName";
const crcKey = "pnachify.crc";

type Result = {
  text: string;
  format: string;
};

export function Converter() {
  const [codes, setCodes] = useState("");
  const [gameName, setGameName] = useState("");
  const [crc, setCrc] = useState("");
  const [manualFormat, setManualFormat] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showFormatPicker, setShowFormatPicker] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setGameName(localStorage.getItem(gameNameKey) ?? "");
    setCrc(localStorage.getItem(crcKey) ?? "");
  }, []);

  const crcValid = /^[0-9a-fA-F]{8}$/.test(crc);
  const fileName = pnachFileName(gameName, crc);
  const failed = result ? countFailedCodes(result.text) : 0;

  async function convert() {
    if (!codes.trim() || busy) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const module = await loadOmni();
      const converted = manualFormat
        ? convertFrom(module, codes, manualFormat, gameName, crc)
        : detectAndConvert(module, codes, gameName, crc);
      const text = withGameTitle(converted.text, gameName);
      setResult({ text, format: converted.format });
      setShowFormatPicker(!hasPatchLines(text));
      localStorage.setItem(gameNameKey, gameName);
      localStorage.setItem(crcKey, crc);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setShowFormatPicker(true);
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setCodes("");
    setResult(null);
    setError(null);
    setShowFormatPicker(false);
    setCopied(false);
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    if (!result) return;
    const blob = new Blob([result.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function share() {
    if (!result) return;
    const file = new File([result.text], fileName, { type: "text/plain" });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return;
      } catch (cause) {
        if (cause instanceof Error && cause.name === "AbortError") return;
      }
    }
    download();
  }

  return (
    <>
      <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
        <label htmlFor="codes" className="text-sm font-medium text-neutral-300">
          Cheat codes
        </label>
        <textarea
          id="codes"
          value={codes}
          onChange={(event) => setCodes(event.target.value)}
          placeholder={"Paste codes here, for example:\n\nMax Money\n20000000 00000001"}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          className="mt-2 h-44 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 p-3 font-mono text-sm outline-none placeholder:text-neutral-600 focus:border-lime-400"
        />

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="game" className="text-sm font-medium text-neutral-300">
              Game name
            </label>
            <input
              id="game"
              value={gameName}
              onChange={(event) => setGameName(event.target.value)}
              placeholder=".hack//G.U. Vol.1"
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-lime-400"
            />
          </div>
          <div>
            <label htmlFor="crc" className="text-sm font-medium text-neutral-300">
              Game CRC
            </label>
            <input
              id="crc"
              value={crc}
              onChange={(event) => setCrc(event.target.value)}
              placeholder="0891B1D0"
              inputMode="text"
              spellCheck={false}
              maxLength={8}
              className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm uppercase outline-none placeholder:text-neutral-600 focus:border-lime-400"
            />
          </div>
        </div>

        {!crcValid && (
          <p className="mt-2 text-xs text-amber-400">
            {crc
              ? "A CRC is 8 hexadecimal digits. Without a valid one, rename the file to your game's CRC before use."
              : "Without a CRC, the emulator won't load the file until you rename it to your game's CRC. It is shown in the emulator's game list."}
          </p>
        )}

        <button
          type="button"
          onClick={convert}
          disabled={busy || !codes.trim()}
          className="mt-4 w-full rounded-xl bg-lime-400 px-4 py-3 text-base font-semibold text-neutral-950 transition enabled:hover:bg-lime-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Converting…" : "Convert to PNACH"}
        </button>

        {showFormatPicker && (
          <div className="mt-3 rounded-xl border border-neutral-700 bg-neutral-950 p-3">
            <label htmlFor="format" className="text-sm font-medium text-neutral-300">
              Pick the input format yourself
            </label>
            <select
              id="format"
              value={manualFormat}
              onChange={(event) => setManualFormat(event.target.value)}
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm outline-none focus:border-lime-400"
            >
              <option value="">Auto-detect</option>
              {outputFormats.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-neutral-500">
              Conversion failed or produced no codes. Try RAW, CRAW, or CRAW variants
              depending on where you copied the codes from.
            </p>
          </div>
        )}
      </section>

      {error && (
        <p className="rounded-xl border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {result && (
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-neutral-300">
              {fileName}
            </p>
            <span className="rounded-full border border-lime-500/40 bg-lime-500/10 px-2 py-0.5 text-xs text-lime-300">
              Detected: {result.format}
            </span>
          </div>

          {failed > 0 && (
            <p className="mt-2 rounded-lg border border-amber-900 bg-amber-950/50 px-3 py-2 text-sm text-amber-300">
              {failed} {failed === 1 ? "code" : "codes"} could not be converted — marked
              inside the file.
            </p>
          )}

          <textarea
            readOnly
            value={result.text}
            spellCheck={false}
            className="mt-3 h-56 w-full resize-y rounded-xl border border-neutral-700 bg-neutral-950 p-3 font-mono text-xs outline-none"
          />

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-medium hover:border-neutral-500"
            >
              {copied ? "Copied" : "Copy"}
            </button>
            <button
              type="button"
              onClick={download}
              className="rounded-xl border border-neutral-700 px-3 py-2 text-sm font-medium hover:border-neutral-500"
            >
              Download
            </button>
            <button
              type="button"
              onClick={share}
              className="rounded-xl bg-lime-400 px-3 py-2 text-sm font-semibold text-neutral-950 hover:bg-lime-300"
            >
              Share
            </button>
          </div>

          <details className="mt-4 text-sm text-neutral-400">
            <summary className="cursor-pointer text-neutral-300">
              How to put it on my phone
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Tap Download or Share and save the .pnach file.</li>
              <li>
                Move it into your emulator&apos;s cheats folder with a file manager.
              </li>
              <li>
                Name it after your game&apos;s CRC if you did not enter one, e.g.
                0891B1D0.pnach.
              </li>
              <li>Open the game; the cheat appears in the emulator&apos;s cheat list.</li>
            </ol>
          </details>

          <button
            type="button"
            onClick={reset}
            className="mt-4 text-sm text-lime-400 hover:text-lime-300"
          >
            Convert another list
          </button>
        </section>
      )}
    </>
  );
}
