import { detectPitchYin, frequencyToNote, noteNameToMidi, midiToFrequency } from "../js/pitch.js";
import { TUNINGS } from "../js/tunings.js";

function sine(freq, sampleRate, n) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    buf[i] = 0.7 * Math.sin((2 * Math.PI * freq * i) / sampleRate);
  }
  return buf;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const sampleRate = 44100;
const n = 4096;
const targets = [
  ["E2", 82.41],
  ["A2", 110],
  ["D3", 146.83],
  ["G3", 196],
  ["B3", 246.94],
  ["E4", 329.63],
  ["D2", 73.42],
  ["F♯3", 185],
];

let failed = 0;
for (const [label, freq] of targets) {
  const found = detectPitchYin(sine(freq, sampleRate, n), sampleRate);
  if (!found) {
    console.error(`FAIL ${label}: no pitch`);
    failed++;
    continue;
  }
  const cents = 1200 * Math.log2(found.frequency / freq);
  const ok = Math.abs(cents) < 8;
  console.log(
    `${ok ? "ok  " : "FAIL"} ${label.padEnd(4)} expected ${freq.toFixed(2)} got ${found.frequency.toFixed(2)} (${cents.toFixed(1)} ¢)`
  );
  if (!ok) failed++;
}

const e2midi = noteNameToMidi("E", 2);
assert(e2midi === 40, `E2 midi ${e2midi}`);
assert(Math.abs(midiToFrequency(69) - 440) < 1e-9, "A4");
const note = frequencyToNote(440);
assert(note.name === "A" && note.octave === 4, "A4 name");

const standard = TUNINGS[0];
assert(standard.strings.map((s) => s.label).join(" ") === "E2 A2 D3 G3 B3 E4", "standard strings");

const noisy = sine(110, sampleRate, n);
for (let i = 0; i < noisy.length; i++) noisy[i] += (Math.random() - 0.5) * 0.05;
const a2 = detectPitchYin(noisy, sampleRate);
assert(a2 && Math.abs(1200 * Math.log2(a2.frequency / 110)) < 15, "A2 with noise");

if (failed) {
  console.error(`\n${failed} pitch checks failed`);
  process.exit(1);
}
console.log("\nall pitch checks passed");
