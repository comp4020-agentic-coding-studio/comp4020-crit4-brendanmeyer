// A string harp: 11 strings on a C-major-pentatonic scale (no combination of
// notes is ever dissonant), shared by mouse/touch drag and keyboard. Strings
// are invisible until first played; the first pluck zooms the camera out
// from a close-up opening view to reveal most of the harp.

const STRING_COUNT = 11;
const SPACING = 140; // world px between adjacent strings
const WORLD_WIDTH = (STRING_COUNT - 1) * SPACING;

// C major pentatonic (C D E G A), two octaves: C4 through C6.
const SEMITONES_ABOVE_C4 = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
const C4 = 261.63;
const FREQUENCIES = SEMITONES_ABOVE_C4.map((s) => C4 * 2 ** (s / 12));

// Each string is triggered by one key from each physical row, top to
// bottom, aligned in the same keyboard column.
const KEY_COLUMNS: string[][] = [
  ["Digit1", "KeyQ", "KeyA", "KeyZ"],
  ["Digit2", "KeyW", "KeyS", "KeyX"],
  ["Digit3", "KeyE", "KeyD", "KeyC"],
  ["Digit4", "KeyR", "KeyF", "KeyV"],
  ["Digit5", "KeyT", "KeyG", "KeyB"],
  ["Digit6", "KeyY", "KeyH", "KeyN"],
  ["Digit7", "KeyU", "KeyJ", "KeyM"],
  ["Digit8", "KeyI", "KeyK", "Comma"],
  ["Digit9", "KeyO", "KeyL", "Period"],
  ["Digit0", "KeyP", "Semicolon", "Slash"],
  ["Minus", "BracketLeft", "Quote", "ShiftRight"],
];

const KEY_TO_STRING = new Map<string, number>(
  KEY_COLUMNS.flatMap((codes, index) => codes.map((code) => [code, index] as const)),
);

const harpEl = document.getElementById("harp");

if (harpEl) {
  const harp: HTMLElement = harpEl;
  const hint = harp.querySelector<HTMLDivElement>(".hint");

  const strings: HTMLDivElement[] = [];
  for (let i = 0; i < STRING_COUNT; i++) {
    const el = document.createElement("div");
    el.className = "string";
    harp.appendChild(el);
    strings.push(el);
  }

  const INITIAL_ZOOM = 5.2;
  let zoom = INITIAL_ZOOM;
  let fitZoom = INITIAL_ZOOM;
  let minZoom = INITIAL_ZOOM;
  let maxZoom = INITIAL_ZOOM;
  let hasRevealed = false;

  function computeFitZoom(): number {
    return (harp.clientWidth * 0.86) / WORLD_WIDTH;
  }

  function recalcZoomBounds() {
    fitZoom = computeFitZoom();
    minZoom = Math.min(fitZoom * 0.6, INITIAL_ZOOM);
    maxZoom = Math.max(INITIAL_ZOOM, fitZoom);
  }

  function layout() {
    const centerScreenX = harp.clientWidth / 2;
    const worldCenter = WORLD_WIDTH / 2;
    for (let i = 0; i < STRING_COUNT; i++) {
      const worldX = i * SPACING;
      strings[i].style.left = `${centerScreenX + (worldX - worldCenter) * zoom}px`;
    }
  }

  function screenXToStringIndex(screenX: number): number {
    const rect = harp.getBoundingClientRect();
    const centerScreenX = rect.width / 2;
    const worldCenter = WORLD_WIDTH / 2;
    const worldX = (screenX - rect.left - centerScreenX) / zoom + worldCenter;
    const index = Math.round(worldX / SPACING);
    return Math.min(STRING_COUNT - 1, Math.max(0, index));
  }

  recalcZoomBounds();
  layout();

  window.addEventListener("resize", () => {
    recalcZoomBounds();
    zoom = hasRevealed ? Math.min(maxZoom, Math.max(minZoom, zoom)) : INITIAL_ZOOM;
    layout();
  });

  function revealHarp() {
    if (hasRevealed) return;
    hasRevealed = true;
    hint?.classList.add("gone");
    recalcZoomBounds();
    const from = zoom;
    const to = fitZoom;
    const duration = 1000;
    const start = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      zoom = from + (to - from) * eased;
      layout();
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  harp.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      if (!hasRevealed) return;
      const factor = Math.exp(-e.deltaY * 0.001);
      zoom = Math.min(maxZoom, Math.max(minZoom, zoom * factor));
      layout();
    },
    { passive: false },
  );

  let audioCtx: AudioContext | null = null;
  function ensureAudio(): AudioContext {
    if (!audioCtx) {
      audioCtx = new AudioContext();
    }
    if (audioCtx.state === "suspended") {
      void audioCtx.resume();
    }
    return audioCtx;
  }

  function pluck(index: number, velocity: number) {
    revealHarp();

    const el = strings[index];
    el.classList.add("played", "flash");
    window.setTimeout(() => el.classList.remove("flash"), 150);

    const ctx = ensureAudio();
    const now = ctx.currentTime;
    const peak = Math.min(0.35, Math.max(0.05, velocity));

    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = FREQUENCIES[index];

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.9);

    const panner = ctx.createStereoPanner();
    panner.pan.value = (index / (STRING_COUNT - 1)) * 2 - 1;

    osc.connect(gain);
    gain.connect(panner);
    panner.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.95);
    osc.addEventListener("ended", () => {
      osc.disconnect();
      gain.disconnect();
      panner.disconnect();
    });
  }

  const drags = new Map<number, { lastIndex: number; lastX: number; lastT: number }>();

  harp.addEventListener("pointerdown", (e) => {
    harp.setPointerCapture(e.pointerId);
    const index = screenXToStringIndex(e.clientX);
    drags.set(e.pointerId, { lastIndex: index, lastX: e.clientX, lastT: e.timeStamp });
    pluck(index, 0.22);
  });

  harp.addEventListener("pointermove", (e) => {
    const drag = drags.get(e.pointerId);
    if (!drag) return;
    const index = screenXToStringIndex(e.clientX);
    const dt = Math.max(1, e.timeStamp - drag.lastT);
    const speed = Math.abs(e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX;
    drag.lastT = e.timeStamp;
    if (index !== drag.lastIndex) {
      drag.lastIndex = index;
      pluck(index, 0.08 + speed * 0.6);
    }
  });

  function endDrag(e: PointerEvent) {
    drags.delete(e.pointerId);
  }
  harp.addEventListener("pointerup", endDrag);
  harp.addEventListener("pointercancel", endDrag);

  window.addEventListener("keydown", (e) => {
    if (e.repeat) return;
    const index = KEY_TO_STRING.get(e.code);
    if (index === undefined) return;
    e.preventDefault();
    pluck(index, 0.22);
  });
}
