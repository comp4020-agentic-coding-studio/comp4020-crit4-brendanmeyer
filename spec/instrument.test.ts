import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";

// Week 5 spec ("An instrument"): only the mechanically checkable lines live
// here. "Expressive, two players sound different", "a stranger can play it
// uninstructed" and "no way to play it wrong" are judged live at the crit --
// no test can stand in for a person's ear.
const DIST = resolve("dist");

function files(dir: string = DIST): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    return entry.isDirectory() ? files(path) : [path];
  });
}

const shipped = files();
const jsFiles = shipped.filter((path) => path.endsWith(".js"));
const bundledScripts = jsFiles.map((path) => readFileSync(path, "utf8"));

const pages = shipped
  .filter((path) => path.endsWith(".html"))
  .map((path) => ({ path, doc: new JSDOM(readFileSync(path, "utf8")).window.document }));

// All script text a page could run: inline <script> bodies, plus local
// <script src> files it points at, plus every bundled .js the build emitted
// (covers hashed chunk names we can't predict from the HTML alone).
function scriptTextFor(page: (typeof pages)[number]): string {
  const inline = [...page.doc.querySelectorAll("script:not([src])")]
    .map((el) => el.textContent ?? "")
    .join("\n");
  const localSrcs = [...page.doc.querySelectorAll("script[src]")]
    .map((el) => el.getAttribute("src") ?? "")
    .filter((src) => src && !/^https?:\/\//.test(src))
    .map((src) => resolve(dirname(page.path), src))
    .filter(existsSync)
    .map((path) => readFileSync(path, "utf8"));
  return [inline, ...localSrcs, ...bundledScripts].join("\n");
}

describe("instrument: sound is made live, not played back", () => {
  for (const page of pages) {
    it(`${page.path.replace(DIST, "")} does not ship a canned audio/video track`, () => {
      const playback = [...page.doc.querySelectorAll("audio, video")].filter(
        (el) => el.hasAttribute("src") || el.querySelector("source[src]"),
      );
      expect(
        playback.map((el) => el.outerHTML),
        "a <audio>/<video> with a source plays a recording back; this week's sound must be synthesized live in the page",
      ).toEqual([]);
    });

    it(`${page.path.replace(DIST, "")} synthesizes sound with the Web Audio API`, () => {
      expect(
        /\bAudioContext\b/.test(scriptTextFor(page)),
        "no reference to (webkit)AudioContext found in the shipped script — the brief asks for live synthesis via the Web Audio API",
      ).toBe(true);
    });
  }
});

describe("instrument: playable with an ordinary input device", () => {
  const INPUT_EVENTS =
    /\b(click|mousedown|mouseup|mousemove|pointerdown|pointerup|pointermove|keydown|keyup|keypress|touchstart|touchend|touchmove)\b/;

  for (const page of pages) {
    it(`${page.path.replace(DIST, "")} listens for mouse, keyboard or touch input`, () => {
      expect(
        INPUT_EVENTS.test(scriptTextFor(page)),
        "no mouse/keyboard/touch event listener found — the brief asks for something playable with whatever is at hand, not a specialised input device",
      ).toBe(true);
    });
  }
});
