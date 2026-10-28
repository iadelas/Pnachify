import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "..");
const cli =
  process.env.OMNI_CLI ?? path.join(repo, "build", "Release", "OmniConvert.exe");
const vectors = path.join(repo, "core", "src", "tests", "vectors", "crypto");
const scratch = path.join(repo, ".temp", "parity");
mkdirSync(scratch, { recursive: true });

const cases = [
  { input: "AR1", output: "ARAW", file: "Arv1-Encrypted.txt" },
  { input: "ARAW", output: "AR1", file: "Arv1-Decrypted.txt" },
  { input: "AR2", output: "ARAW", file: "ARv2-Encrypted.txt" },
  { input: "ARAW", output: "AR2", file: "ARv2-Decrypted.txt" },
  { input: "CB", output: "CRAW", file: "CB1-6[Encryption]-4 x 4 Evolution - SLUS_200.91.txt" },
  { input: "CRAW", output: "CB", file: "CB1-6[Decryption]-4 x 4 Evolution - SLUS_200.91.txt" },
  { input: "CB7_COMMON", output: "CRAW", file: "CB7+[Encryption]-187 Ride Or Die - SLUS_211.16.txt" },
  { input: "CRAW", output: "CB7_COMMON", file: "CB7+[Decryption]-187 Ride Or Die - SLUS_211.16.txt" },
  { input: "XP5", output: "GRAW", file: "Xploderv5+[Encrypted]-4x4 Evo 2.txt" },
  { input: "GRAW", output: "XP5", file: "Xploderv5+[Decrypted]-4x4 Evo 2.txt" },
  { input: "XP5", output: "GRAW", file: "Xploderv5+[Encrypted]-Catwoman.txt" },
  { input: "GRAW", output: "XP5", file: "Xploderv5+[Decrypted]-Catwoman - Copy.txt" },
  { input: "ARMAX", output: "MAXRAW", file: "ARMAX[ENCRYPTED]-.hack__G.U. Vol 1_ Rebirth.txt" },
  { input: "MAXRAW", output: "ARMAX", file: "ARMAX[DECRYPTED-Armax(RAW)]-.hack__G.U. Vol 1_ Rebirth - Copy.txt" },
  {
    input: "ARMAX",
    output: "PNACH",
    file: "ARMAX[ENCRYPTED]-.hack__G.U. Vol 1_ Rebirth.txt",
    gameName: "Sample Game",
    crc: "12345678",
  },
];

const createOmniModule = (
  await import(
    pathToFileURL(path.join(repo, "web", "src", "lib", "generated", "omni.mjs")).href
  )
).default;

const wasm = await createOmniModule({
  locateFile: () => path.join(repo, "web", "public", "omni.wasm"),
});

function convertWithWasm(text, input, output, gameName = "", crc = "") {
  const pointer = wasm.ccall(
    "omni_convert",
    "number",
    ["string", "string", "string", "string", "string", "number"],
    [text, input, output, gameName, crc, 1],
  );
  if (!pointer) {
    throw new Error(wasm.ccall("omni_last_error", "string", [], []));
  }
  const result = wasm.UTF8ToString(pointer);
  wasm._omni_free(pointer);
  return result;
}

for (const [index, item] of cases.entries()) {
  test(`${item.input} -> ${item.output} matches native CLI for ${item.file}`, () => {
    const inputPath = path.join(vectors, item.file);
    const expectedPath = path.join(scratch, `native-${index}.txt`);

    const cliArgs = [
      "convert",
      item.input,
      item.output,
      inputPath,
      expectedPath,
      "05100518",
      "4",
      "04030209",
      "0000",
      "0",
      "ORIGINAL",
    ];
    if (item.crc !== undefined) {
      cliArgs.push(item.crc, item.gameName ?? "");
    }

    execFileSync(cli, cliArgs, { stdio: "pipe" });

    const expected = readFileSync(expectedPath, "utf8");
    const actual = convertWithWasm(
      readFileSync(inputPath, "utf8"),
      item.input,
      item.output,
      item.gameName,
      item.crc,
    );

    assert.equal(actual, expected);
  });
}

test("unknown input format reports an error instead of crashing", () => {
  assert.throws(() => convertWithWasm("00000000 00000001", "NOT_A_FORMAT", "PNACH"), /unknown input format/);
});
