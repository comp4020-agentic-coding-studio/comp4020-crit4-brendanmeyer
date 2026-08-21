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

  function worldXToScreenX(worldX: number): number {
    const centerScreenX = harp.clientWidth / 2;
    const worldCenter = WORLD_WIDTH / 2;
    return centerScreenX + (worldX - worldCenter) * zoom;
  }

  function layout() {
    for (let i = 0; i < STRING_COUNT; i++) {
      strings[i].style.left = `${worldXToScreenX(i * SPACING)}px`;
    }
  }

  function screenXToWorldX(screenX: number, zoomLevel: number): number {
    const rect = harp.getBoundingClientRect();
    const centerScreenX = rect.width / 2;
    const worldCenter = WORLD_WIDTH / 2;
    return (screenX - rect.left - centerScreenX) / zoomLevel + worldCenter;
  }

  function screenXToStringIndexAtZoom(screenX: number, zoomLevel: number): number {
    const index = Math.round(screenXToWorldX(screenX, zoomLevel) / SPACING);
    return Math.min(STRING_COUNT - 1, Math.max(0, index));
  }

  function screenXToStringIndex(screenX: number): number {
    return screenXToStringIndexAtZoom(screenX, zoom);
  }

  recalcZoomBounds();
  layout();

  window.addEventListener("resize", () => {
    // Rescale by the change in fit zoom (not just clamp the old value into
    // the new bounds): clamping alone leaves zoom at its old absolute level,
    // which is still "in range" but frames only a couple of strings when the
    // viewport has shrunk a lot (e.g. desktop width down to a phone).
    const oldFitZoom = fitZoom;
    recalcZoomBounds();
    zoom = hasRevealed
      ? Math.min(maxZoom, Math.max(minZoom, zoom * (fitZoom / oldFitZoom)))
      : INITIAL_ZOOM;
    layout();
  });

  function revealHarp() {
    if (hasRevealed) return;
    hasRevealed = true;
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

  function flashString(index: number) {
    const el = strings[index];
    el.classList.add("played", "flash");
    window.setTimeout(() => el.classList.remove("flash"), 150);
  }

  function pluck(index: number, velocity: number) {
    revealHarp();
    flashString(index);

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

  // An unattended intro demo: a dot appears over a real, playable string, plays
  // it, then swipes across a few strings like a hand strumming, before fading
  // away for good. It never makes sound (the browser blocks audio before a
  // real gesture anyway) and yields the moment any real input arrives.
  let demoActive = true;

  // A screen-space pick (not a world/string-index one) so the dot always
  // lands somewhere actually on screen, at any zoom or viewport width.
  function pickDemoStartScreenX(): number {
    const margin = harp.clientWidth * 0.15;
    return margin + Math.random() * (harp.clientWidth - margin * 2);
  }

  function pickSwipeTarget(startIndex: number): number {
    const length = 3 + Math.floor(Math.random() * 4);
    return Math.random() < 0.5
      ? Math.min(STRING_COUNT - 1, startIndex + length)
      : Math.max(0, startIndex - length);
  }

  function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
  }

  function positionHint(worldX: number, yWobblePercent = 0, xJitterPx = 0) {
    if (!hint) return;
    hint.style.left = `${worldXToScreenX(worldX) + xJitterPx}px`;
    hint.style.top = `calc(50% + ${yWobblePercent}%)`;
  }

  function demoPluck(index: number) {
    revealHarp();
    flashString(index);
  }

  function hideHintNow() {
    hint?.classList.add("gone");
  }

  function cancelDemo() {
    if (!demoActive) return;
    demoActive = false;
    hideHintNow();
  }

  function runSwipe(startIndex: number, targetIndex?: number) {
    if (!demoActive) return;
    const endIndex =
      targetIndex === undefined
        ? pickSwipeTarget(startIndex)
        : Math.min(STRING_COUNT - 1, Math.max(0, targetIndex));
    // Anchor to the dot's actual current screen spot rather than
    // startIndex's world position: the camera is still mid-zoom-out here, so
    // re-deriving from the index would jump the dot to a mismatched spot.
    const fromWorld = screenXToWorldX(demoStartScreenX, zoom);
    const toWorld = endIndex * SPACING;
    const duration =
      (700 + Math.abs(endIndex - startIndex) * 150) * (0.85 + Math.random() * 0.3);
    const start = performance.now();
    let lastIndex = startIndex;

    function step(now: number) {
      if (!demoActive) return;
      const t = Math.min(1, (now - start) / duration);
      const eased = easeInOutCubic(t);
      const worldX = fromWorld + (toWorld - fromWorld) * eased;
      const jitterX = Math.sin(now * 0.012 + startIndex) * 3;
      const wobbleY = Math.sin(t * Math.PI * 3 + startIndex) * 4;
      positionHint(worldX, wobbleY, jitterX);

      const index = Math.min(STRING_COUNT - 1, Math.max(0, Math.round(worldX / SPACING)));
      if (index !== lastIndex) {
        demoPluck(index);
        lastIndex = index;
      }

      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        demoActive = false;
        hideHintNow();
      }
    }
    requestAnimationFrame(step);
  }

  const demoStartScreenX = pickDemoStartScreenX();
  // Read against the revealed (fit) layout, not the tight opening zoom, so
  // the dot's implied note matches where it visually sits once revealed.
  const demoStartIndex = screenXToStringIndexAtZoom(demoStartScreenX, fitZoom);
  if (hint) {
    hint.style.left = `${demoStartScreenX}px`;
  }

  const drags = new Map<number, { lastIndex: number; lastX: number; lastT: number }>();

  harp.addEventListener("pointerdown", (e) => {
    const isFirstPluck = !hasRevealed;
    harp.setPointerCapture(e.pointerId);
    // Before the reveal, the camera is zoomed in tight, so mapping the click
    // through the live (pre-reveal) zoom would collapse almost any click to
    // the strings nearest centre. Read the first click against the revealed
    // (fit) layout instead, so it plays the note the user actually pointed at.
    const index = isFirstPluck
      ? screenXToStringIndexAtZoom(e.clientX, fitZoom)
      : screenXToStringIndex(e.clientX);
    drags.set(e.pointerId, { lastIndex: index, lastX: e.clientX, lastT: e.timeStamp });
    pluck(index, 0.22);
    if (isFirstPluck) {
      runSwipe(demoStartIndex, index === demoStartIndex ? undefined : index);
    } else {
      cancelDemo();
    }
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
      cancelDemo();
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
    const isFirstPluck = !hasRevealed;
    pluck(index, 0.22);
    if (isFirstPluck) {
      runSwipe(demoStartIndex, index === demoStartIndex ? undefined : index);
    } else {
      cancelDemo();
    }
  });
}
