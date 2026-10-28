import { Converter } from "./converter";

export default function Home() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 px-4 pb-4 pt-10">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">
          Pnach<span className="text-lime-400">ify</span>
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          PS2 cheat codes to PNACH, in your browser.
        </p>
      </header>
      <Converter />
    </main>
  );
}
