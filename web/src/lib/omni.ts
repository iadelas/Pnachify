export interface OmniModule {
  ccall(
    name: string,
    returnType: string,
    argTypes: string[],
    args: unknown[],
  ): number;
  UTF8ToString(pointer: number): string;
  _omni_free(pointer: number): void;
}

export type OmniFactory = (options?: {
  locateFile?: (file: string) => string;
}) => Promise<OmniModule>;

declare global {
  interface Window {
    createOmniModule?: OmniFactory;
  }
}

export const outputFormats = [
  "RAW",
  "MAXRAW",
  "ARAW",
  "CRAW",
  "GS12RAW",
  "GRAW",
  "AR1",
  "AR2",
  "ARMAX",
  "CB",
  "CB7_COMMON",
  "GS3",
  "GS5",
  "SMC",
  "XP13",
  "XP4",
  "XP5",
  "PNACH",
] as const;

let pending: Promise<OmniModule> | null = null;

function loadGlue(): Promise<OmniFactory> {
  if (window.createOmniModule) return Promise.resolve(window.createOmniModule);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/omni.js";
    script.onload = () => {
      if (window.createOmniModule) resolve(window.createOmniModule);
      else reject(new Error("The converter failed to start"));
    };
    script.onerror = () => reject(new Error("The converter could not be downloaded"));
    document.head.appendChild(script);
  });
}

export function loadOmni(): Promise<OmniModule> {
  if (!pending) {
    pending = loadGlue()
      .then((factory) => factory({ locateFile: () => "/omni.wasm" }))
      .catch((error: unknown) => {
        pending = null;
        throw error;
      });
  }
  return pending;
}

function readResult(module: OmniModule, pointer: number): string {
  if (!pointer) {
    const message = module.ccall("omni_last_error", "string", [], []);
    throw new Error(
      typeof message === "number" ? "Conversion failed" : String(message),
    );
  }
  const text = module.UTF8ToString(pointer);
  module._omni_free(pointer);
  return text;
}

export function detectAndConvert(
  module: OmniModule,
  text: string,
  gameName: string,
  crc: string,
): { text: string; format: string } {
  const pointer = module.ccall(
    "omni_convert_auto",
    "number",
    ["string", "string", "string", "string", "number"],
    [text, "PNACH", gameName, crc, 1],
  );
  const format = module.ccall("omni_last_format", "string", [], []);
  return {
    text: readResult(module, pointer),
    format: typeof format === "number" ? "RAW" : String(format),
  };
}

export function convertFrom(
  module: OmniModule,
  text: string,
  inputFormat: string,
  gameName: string,
  crc: string,
): { text: string; format: string } {
  const pointer = module.ccall(
    "omni_convert",
    "number",
    ["string", "string", "string", "string", "string", "number"],
    [text, inputFormat, "PNACH", gameName, crc, 1],
  );
  return { text: readResult(module, pointer), format: inputFormat };
}

export function pnachFileName(gameName: string, crc: string): string {
  if (/^[0-9a-fA-F]{8}$/.test(crc)) return `${crc.toUpperCase()}.pnach`;
  const slug = gameName
    .trim()
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${slug || "cheats"}.pnach`;
}

export function withGameTitle(text: string, gameName: string): string {
  if (!gameName.trim()) return text;
  return `gametitle=${gameName.trim()}\n${text}`;
}

export function countFailedCodes(text: string): number {
  return text.split("\n").filter((line) => line.startsWith("// [ERROR]")).length;
}

const masterCodeTypes = new Set(["9", "F"]);

function hasMasterLine(section: string[]): boolean {
  return section.some((line) => {
    if (!line.startsWith("patch=")) return false;
    const address = line.split(",")[2] ?? "";
    return masterCodeTypes.has((address[0] ?? "").toUpperCase());
  });
}

export function dropMasterCodes(text: string): { text: string; dropped: number } {
  const kept: string[] = [];
  let section: string[] = [];
  let dropped = 0;

  for (const line of text.split("\n")) {
    if (line.startsWith("[")) {
      if (section.length > 0) {
        if (hasMasterLine(section)) dropped += 1;
        else kept.push(...section);
      }
      section = [line];
      continue;
    }
    if (section.length > 0) section.push(line);
    else kept.push(line);
  }

  if (section.length > 0) {
    if (hasMasterLine(section)) dropped += 1;
    else kept.push(...section);
  }

  return { text: kept.join("\n"), dropped };
}

export function hasPatchLines(text: string): boolean {
  return text.split("\n").some((line) => line.startsWith("patch="));
}
