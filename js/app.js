import { detectPitchYin, rms, frequencyToNote, centsBetween } from "./pitch.js";
import { TUNINGS, A4_HZ, closestString } from "./tunings.js";

const IN_TUNE_ENTER = 5;
const IN_TUNE_EXIT = 8;
const SILENCE_RMS = 0.008;
const HOLD_MS = 280;
const CENTS_CLAMP = 50;

const els = {
  app: document.querySelector(".app"),
  needle: document.getElementById("needle"),
  centsLabel: document.getElementById("cents"),
  noteName: document.getElementById("note-name"),
  noteOctave: document.getElementById("note-octave"),
  hz: document.getElementById("hz"),
  status: document.getElementById("status"),
  start: document.getElementById("start"),
  auto: document.getElementById("auto"),
  tunings: document.getElementById("tunings"),
  strings: document.getElementById("strings"),
  levelFill: document.getElementById("level-fill"),
  gauge: document.querySelector(".gauge"),
  hint: document.getElementById("hint"),
};

const state = {
  audioCtx: null,
  stream: null,
  analyser: null,
  timeBuf: null,
  running: false,
  raf: 0,
  tuning: TUNINGS[0],
  selectedString: null,
  targetCents: 0,
  needleCents: 0,
  lastHeard: 0,
  inTune: false,
  lastHz: 0,
  lastNote: null,
  lastFrame: 0,
};

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function renderTunings() {
  els.tunings.innerHTML = "";
  for (const tuning of TUNINGS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip" + (tuning.id === state.tuning.id ? " is-active" : "");
    btn.dataset.id = tuning.id;
    btn.innerHTML = `<span>${tuning.name}</span><small>${tuning.short}</small>`;
    btn.addEventListener("click", () => setTuning(tuning.id));
    els.tunings.appendChild(btn);
  }
}

function renderStrings() {
  els.strings.innerHTML = "";
  const count = state.tuning.strings.length;
  state.tuning.strings.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "string" + (state.selectedString?.id === s.id ? " is-selected" : "");
    btn.dataset.id = s.id;
    btn.style.setProperty("--gauge", `${2.2 + (count - 1 - i) * 0.55}px`);
    btn.innerHTML = `
      <span class="string-num">${count - i}</span>
      <span class="string-wire" aria-hidden="true"></span>
      <span class="string-note">${s.name}<sup>${s.octave}</sup></span>
    `;
    btn.setAttribute("aria-label", `Play reference ${s.label}`);
    btn.addEventListener("click", () => onStringTap(s));
    els.strings.appendChild(btn);
  });
}

function setTuning(id) {
  const next = TUNINGS.find((t) => t.id === id) || TUNINGS[0];
  state.tuning = next;
  state.selectedString = null;
  renderTunings();
  renderStrings();
  updateAutoButton();
}

function onStringTap(s) {
  state.selectedString = s;
  renderStrings();
  updateAutoButton();
  playReference(s.hz);
}

function updateAutoButton() {
  els.auto.classList.toggle("is-active", !state.selectedString);
  els.auto.setAttribute("aria-pressed", String(!state.selectedString));
}

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.dataset.kind = kind;
}

function setHint(text) {
  els.hint.textContent = text;
}

function rotateNeedle(cents) {
  const clamped = Math.max(-CENTS_CLAMP, Math.min(CENTS_CLAMP, cents));
  const deg = (clamped / CENTS_CLAMP) * 90;
  els.needle.setAttribute("transform", `rotate(${deg} 160 160)`);
}

function formatCents(cents) {
  const v = Math.round(cents);
  if (v === 0) return "0 ¢";
  return `${v > 0 ? "+" : ""}${v} ¢`;
}

function applyReadout({ note, cents, hz, heard, closest }) {
  if (!heard) {
    els.app.classList.remove("is-intune", "is-flat", "is-sharp", "is-hearing");
    els.gauge.classList.remove("is-intune");
    return;
  }

  els.app.classList.add("is-hearing");
  els.noteName.textContent = note.name;
  els.noteOctave.textContent = note.octave;
  els.hz.textContent = `${hz.toFixed(1)} Hz`;
  els.centsLabel.textContent = formatCents(cents);

  const abs = Math.abs(cents);
  if (state.inTune) {
    if (abs > IN_TUNE_EXIT) state.inTune = false;
  } else if (abs <= IN_TUNE_ENTER) {
    state.inTune = true;
  }

  els.app.classList.toggle("is-intune", state.inTune);
  els.app.classList.toggle("is-flat", !state.inTune && cents < 0);
  els.app.classList.toggle("is-sharp", !state.inTune && cents > 0);
  els.gauge.classList.toggle("is-intune", state.inTune);

  if (state.inTune) {
    setStatus("In tune", "ok");
  } else if (cents < 0) {
    setStatus("Tune up", "flat");
  } else {
    setStatus("Tune down", "sharp");
  }

  for (const btn of els.strings.querySelectorAll(".string")) {
    btn.classList.toggle("is-closest", closest && btn.dataset.id === closest.id);
  }
}

function ensureAudioContext() {
  const Ctor = window.AudioContext || window.webkitAudioContext;
  if (!Ctor) throw new Error("Web Audio is not supported in this browser.");
  if (!state.audioCtx) state.audioCtx = new Ctor();
  return state.audioCtx;
}

function playReference(freq) {
  let ctx;
  try {
    ctx = ensureAudioContext();
  } catch (err) {
    setStatus(err.message, "err");
    return;
  }

  if (ctx.state === "suspended") ctx.resume();

  const now = ctx.currentTime;
  const dur = 1.55;
  const master = ctx.createGain();
  master.gain.setValueAtTime(0.0001, now);
  master.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
  master.gain.exponentialRampToValueAtTime(0.12, now + 0.22);
  master.gain.exponentialRampToValueAtTime(0.0001, now + dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(Math.min(3200, freq * 8), now);
  filter.Q.value = 0.7;

  const sine = ctx.createOscillator();
  sine.type = "sine";
  sine.frequency.value = freq;

  const partial = ctx.createOscillator();
  partial.type = "triangle";
  partial.frequency.value = freq;
  const partialGain = ctx.createGain();
  partialGain.gain.value = 0.18;

  sine.connect(filter);
  partial.connect(partialGain).connect(filter);
  filter.connect(master).connect(ctx.destination);

  sine.start(now);
  partial.start(now);
  sine.stop(now + dur);
  partial.stop(now + dur);

  const note = frequencyToNote(freq, A4_HZ, state.tuning.preferFlats);
  els.noteName.textContent = note.name;
  els.noteOctave.textContent = note.octave;
  els.hz.textContent = `${freq.toFixed(1)} Hz`;
  els.centsLabel.textContent = "0 ¢";
  state.targetCents = 0;
  if (prefersReducedMotion()) {
    state.needleCents = 0;
    rotateNeedle(0);
  }
  setStatus("Reference tone", "");
}

async function startMic() {
  if (!window.isSecureContext) {
    setStatus("Microphone needs HTTPS or localhost.", "err");
    setHint("Open this page over HTTPS (GitHub Pages) or via http://localhost.");
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Microphone API is not available.", "err");
    return;
  }

  els.start.disabled = true;
  els.start.textContent = "Starting…";

  try {
    const ctx = ensureAudioContext();
    if (ctx.state === "suspended") await ctx.resume();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: 1,
      },
    });

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);

    state.stream = stream;
    state.analyser = analyser;
    state.timeBuf = new Float32Array(analyser.fftSize);
    state.running = true;
    state.lastFrame = performance.now();

    els.start.textContent = "Stop";
    els.start.disabled = false;
    els.start.classList.add("is-on");
    els.app.classList.add("is-live");
    setStatus("Listening", "");
    setHint("Play a string. Tap a string to hear a reference pitch.");
    loop();
  } catch (err) {
    els.start.disabled = false;
    els.start.textContent = "Start tuner";
    handleMicError(err);
  }
}

function handleMicError(err) {
  const name = err?.name || "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    setStatus("Microphone blocked", "err");
    setHint("Allow microphone access in the browser, then press Start tuner again.");
    return;
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    setStatus("No microphone found", "err");
    setHint("Plug in a mic or check system sound settings, then try again.");
    return;
  }
  if (name === "NotReadableError") {
    setStatus("Microphone is in use", "err");
    setHint("Close other apps using the mic, then try again.");
    return;
  }
  setStatus("Could not start microphone", "err");
  setHint(err?.message || "Something went wrong requesting audio input.");
}

function stopMic() {
  state.running = false;
  if (state.raf) cancelAnimationFrame(state.raf);
  state.raf = 0;
  if (state.stream) {
    for (const track of state.stream.getTracks()) track.stop();
  }
  state.stream = null;
  state.analyser = null;
  els.start.textContent = "Start tuner";
  els.start.classList.remove("is-on");
  els.app.classList.remove("is-live", "is-hearing", "is-intune", "is-flat", "is-sharp");
  els.gauge.classList.remove("is-intune");
  els.levelFill.style.transform = "scaleX(0)";
  setStatus("Stopped", "");
  setHint("Press Start tuner to use the microphone, or tap a string for a reference tone.");
}

function toggleMic() {
  if (state.running) stopMic();
  else startMic();
}

function loop(now = performance.now()) {
  if (!state.running || !state.analyser) return;
  state.raf = requestAnimationFrame(loop);

  const dt = Math.min(0.05, (now - state.lastFrame) / 1000) || 0.016;
  state.lastFrame = now;

  state.analyser.getFloatTimeDomainData(state.timeBuf);
  const level = rms(state.timeBuf);
  const levelN = Math.min(1, level / 0.12);
  els.levelFill.style.transform = `scaleX(${levelN})`;

  let heard = false;
  let cents = 0;
  let note = state.lastNote;
  let hz = state.lastHz;
  let closest = null;

  if (level >= SILENCE_RMS) {
    const pitch = detectPitchYin(state.timeBuf, state.audioCtx.sampleRate);
    if (pitch) {
      hz = pitch.frequency;
      const match = closestString(hz, state.tuning.strings);
      closest = match.string;
      const target = state.selectedString || closest;
      cents = centsBetween(hz, target.hz);
      note = frequencyToNote(hz, A4_HZ, state.tuning.preferFlats);
      if (!state.selectedString) {
        note = { ...note, name: target.name, octave: target.octave };
      }
      state.lastHeard = now;
      state.lastHz = hz;
      state.lastNote = note;
      heard = true;
    }
  }

  if (!heard && now - state.lastHeard < HOLD_MS && state.lastNote) {
    heard = true;
    note = state.lastNote;
    hz = state.lastHz;
    cents = state.targetCents;
    closest = state.selectedString || closestString(hz, state.tuning.strings).string;
  }

  if (heard) {
    state.targetCents = cents;
  } else {
    state.targetCents += (0 - state.targetCents) * (1 - Math.exp(-dt * 3.2));
    if (Math.abs(state.targetCents) < 0.2) state.targetCents = 0;
    state.inTune = false;
    setStatus(state.running ? "Listening" : "", "");
    for (const btn of els.strings.querySelectorAll(".string")) {
      btn.classList.remove("is-closest");
    }
  }

  const follow = prefersReducedMotion() ? 1 : 1 - Math.exp(-dt * 14);
  state.needleCents += (state.targetCents - state.needleCents) * follow;
  rotateNeedle(state.needleCents);
  applyReadout({
    note: note || { name: "—", octave: "" },
    cents: state.needleCents,
    hz: hz || 0,
    heard,
    closest: state.selectedString || closest,
  });

  if (!heard) {
    if (Math.abs(state.needleCents) < 0.4) {
      els.centsLabel.textContent = "— ¢";
    } else {
      els.centsLabel.textContent = formatCents(state.needleCents);
    }
  }
}

function onKeydown(e) {
  if (e.target.closest("input, textarea, select")) return;
  if (e.code === "Space") {
    e.preventDefault();
    toggleMic();
    return;
  }
  if (e.key.toLowerCase() === "a" && !e.metaKey && !e.ctrlKey) {
    state.selectedString = null;
    renderStrings();
    updateAutoButton();
    return;
  }
  const n = Number(e.key);
  if (n >= 1 && n <= state.tuning.strings.length) {
    const idx = state.tuning.strings.length - n;
    onStringTap(state.tuning.strings[idx]);
  }
}

function init() {
  renderTunings();
  renderStrings();
  updateAutoButton();
  rotateNeedle(0);
  setHint("Press Start tuner to use the microphone, or tap a string for a reference tone.");

  els.start.addEventListener("click", toggleMic);
  els.auto.addEventListener("click", () => {
    state.selectedString = null;
    renderStrings();
    updateAutoButton();
  });
  window.addEventListener("keydown", onKeydown);
  window.addEventListener("pagehide", () => {
    if (state.running) stopMic();
  });

  if (!window.isSecureContext) {
    setStatus("Needs a secure origin", "err");
    setHint("Open via https://krhogan2.github.io/guitar-tuner/ or http://localhost.");
  }
}

init();
