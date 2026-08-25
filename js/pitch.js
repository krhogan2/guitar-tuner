/**
 * YIN fundamental-frequency estimator
 * de Cheveigné & Kawahara, JASA 2002.
 */

const DEFAULTS = {
  threshold: 0.12,
  minHz: 65,
  maxHz: 1000,
};

export function rms(buffer) {
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) {
    const v = buffer[i];
    sum += v * v;
  }
  return Math.sqrt(sum / buffer.length);
}

export function detectPitchYin(buffer, sampleRate, options = {}) {
  const threshold = options.threshold ?? DEFAULTS.threshold;
  const minHz = options.minHz ?? DEFAULTS.minHz;
  const maxHz = options.maxHz ?? DEFAULTS.maxHz;

  const size = buffer.length;
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(Math.floor(size / 2), Math.floor(sampleRate / minHz));
  if (tauMax <= tauMin + 2) return null;

  const yin = new Float32Array(tauMax + 1);

  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    const limit = size - tau;
    for (let i = 0; i < limit; i++) {
      const d = buffer[i] - buffer[i + tau];
      sum += d * d;
    }
    yin[tau] = sum;
  }

  yin[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += yin[tau];
    yin[tau] = running === 0 ? 1 : (yin[tau] * tau) / running;
  }

  let tauEstimate = -1;
  for (let tau = tauMin; tau <= tauMax; tau++) {
    if (yin[tau] < threshold) {
      while (tau + 1 <= tauMax && yin[tau + 1] < yin[tau]) tau++;
      tauEstimate = tau;
      break;
    }
  }

  if (tauEstimate === -1) {
    let minVal = 1;
    let minTau = -1;
    for (let tau = tauMin; tau <= tauMax; tau++) {
      if (yin[tau] < minVal) {
        minVal = yin[tau];
        minTau = tau;
      }
    }
    if (minTau === -1 || minVal > 0.45) return null;
    tauEstimate = minTau;
  }

  const betterTau = parabolic(yin, tauEstimate);
  if (betterTau <= 0) return null;

  const probability = Math.max(0, Math.min(1, 1 - yin[tauEstimate]));
  if (probability < 0.55) return null;

  const frequency = sampleRate / betterTau;
  if (frequency < minHz || frequency > maxHz) return null;

  return { frequency, probability };
}

function parabolic(arr, tau) {
  if (tau < 1 || tau + 1 >= arr.length) return tau;
  const s0 = arr[tau - 1];
  const s1 = arr[tau];
  const s2 = arr[tau + 1];
  const denom = 2 * s1 - s2 - s0;
  if (Math.abs(denom) < 1e-12) return tau;
  const delta = (s2 - s0) / (2 * denom);
  if (!Number.isFinite(delta) || Math.abs(delta) > 1) return tau;
  return tau + delta;
}

const NOTE_NAMES_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const NOTE_NAMES_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

export function frequencyToNote(frequency, a4 = 440, preferFlats = false) {
  const midi = 69 + 12 * Math.log2(frequency / a4);
  const rounded = Math.round(midi);
  const cents = (midi - rounded) * 100;
  const pc = ((rounded % 12) + 12) % 12;
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return {
    midi: rounded,
    name: names[pc],
    octave: Math.floor(rounded / 12) - 1,
    cents,
    frequency,
  };
}

export function centsBetween(frequency, targetHz) {
  return 1200 * Math.log2(frequency / targetHz);
}

export function midiToFrequency(midi, a4 = 440) {
  return a4 * 2 ** ((midi - 69) / 12);
}

export function noteNameToMidi(name, octave) {
  const map = {
    C: 0,
    "C♯": 1,
    "D♭": 1,
    D: 2,
    "D♯": 3,
    "E♭": 3,
    E: 4,
    F: 5,
    "F♯": 6,
    "G♭": 6,
    G: 7,
    "G♯": 8,
    "A♭": 8,
    A: 9,
    "A♯": 10,
    "B♭": 10,
    B: 11,
  };
  const pc = map[name];
  if (pc === undefined) throw new Error(`Unknown note ${name}`);
  return (octave + 1) * 12 + pc;
}
