import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

const createOmniModule = createRequire(import.meta.url)(
  path.join(repo, "web", "public", "omni.js"),
);

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

function convertAuto(text, output) {
  const pointer = wasm.ccall(
    "omni_convert_auto",
    "number",
    ["string", "string", "string", "string", "number"],
    [text, output, "", "", 1],
  );
  if (!pointer) {
    throw new Error(wasm.ccall("omni_last_error", "string", [], []));
  }
  const result = wasm.UTF8ToString(pointer);
  wasm._omni_free(pointer);
  return { text: result, format: wasm.ccall("omni_last_format", "string", [], []) };
}

const detectionCases = [
  { file: "Arv1-Encrypted.txt", expected: ["AR1"] },
  { file: "ARv2-Encrypted.txt", expected: ["AR2"] },
  { file: "CB1-6[Encryption]-4 x 4 Evolution - SLUS_200.91.txt", expected: ["CB"] },
  { file: "CB7+[Encryption]-187 Ride Or Die - SLUS_211.16.txt", expected: ["CB7_COMMON"] },
  { file: "Xploderv5+[Encrypted]-4x4 Evo 2.txt", expected: ["GS5", "GS3"] },
  { file: "Xploderv5+[Encrypted]-Catwoman.txt", expected: ["GS5", "GS3"] },
  { file: "ARMAX[ENCRYPTED]-.hack__G.U. Vol 1_ Rebirth.txt", expected: ["ARMAX"] },
];

for (const item of detectionCases) {
  test(`auto-detect finds ${item.expected.join(" or ")} in ${item.file}`, () => {
    const source = readFileSync(path.join(vectors, item.file), "utf8");
    const detected = convertAuto(source, "PNACH");
    assert.ok(
      item.expected.includes(detected.format),
      `detected ${detected.format}, expected one of ${item.expected.join(", ")}`,
    );
    assert.equal(detected.text, convertWithWasm(source, detected.format, "PNACH"));
  });
}

test("auto-detect falls back to RAW for unlabelled raw codes", () => {
  const detected = convertAuto("Max Money\n20000000 00000001\n", "PNACH");
  assert.match(detected.text, /patch=1,EE,20000000,extended,00000001/);
});

const decryptedCases = [
  { file: "CB1-6[Decryption]-4 x 4 Evolution - SLUS_200.91.txt", format: "CRAW" },
  { file: "CB7+[Decryption]-187 Ride Or Die - SLUS_211.16.txt", format: "CRAW" },
  { file: "ARMAX[DECRYPTED-Armax(RAW)]-.hack__G.U. Vol 1_ Rebirth - Copy.txt", format: "MAXRAW" },
  { file: "Arv1-Decrypted.txt", format: "RAW" },
  { file: "ARv2-Decrypted.txt", format: "ARAW" },
  { file: "Xploderv5+[Decrypted]-4x4 Evo 2.txt", format: "RAW" },
  { file: "Xploderv5+[Decrypted]-Catwoman - Copy.txt", format: "GS3" },
];

for (const item of decryptedCases) {
  test(`does not re-scramble already decrypted ${item.file}`, () => {
    const source = readFileSync(path.join(vectors, item.file), "utf8");
    const detected = convertAuto(source, "PNACH");
    assert.equal(detected.format, item.format);
    assert.equal(detected.text, convertWithWasm(source, item.format, "PNACH"));
  });
}

test("does not re-scramble a decrypted CodeBreaker list", () => {
  const source = readFileSync(
    path.join(vectors, "CB1-6[Decryption]-4 x 4 Evolution - SLUS_200.91.txt"),
    "utf8",
  );
  const detected = convertAuto(source, "PNACH");
  assert.match(detected.text, /patch=1,EE,208B235C,extended,FFFFFFFF/);
  assert.match(detected.text, /patch=1,EE,203A6F7C,extended,41200000/);
});

test("auto-detect still finds a CB list with no CRYPT tag", () => {
  const source = readFileSync(
    path.join(vectors, "CB1-6[Encryption]-4 x 4 Evolution - SLUS_200.91.txt"),
    "utf8",
  ).replace(/,?\s*CRYPT_[A-Z0-9_]+/g, "");
  const detected = convertAuto(source, "PNACH");
  assert.equal(detected.format, "CB");
});

