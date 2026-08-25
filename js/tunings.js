import { midiToFrequency, noteNameToMidi } from "./pitch.js";

const A4 = 440;

function stringDef(id, name, octave) {
  const midi = noteNameToMidi(name, octave);
  return {
    id,
    name,
    octave,
    label: `${name}${octave}`,
    midi,
    hz: midiToFrequency(midi, A4),
  };
}

export const A4_HZ = A4;

export const TUNINGS = [
  {
    id: "standard",
    name: "Standard",
    short: "EADGBE",
    preferFlats: false,
    strings: [
      stringDef("e2", "E", 2),
      stringDef("a2", "A", 2),
      stringDef("d3", "D", 3),
      stringDef("g3", "G", 3),
      stringDef("b3", "B", 3),
      stringDef("e4", "E", 4),
    ],
  },
  {
    id: "drop-d",
    name: "Drop D",
    short: "DADGBE",
    preferFlats: false,
    strings: [
      stringDef("d2", "D", 2),
      stringDef("a2", "A", 2),
      stringDef("d3", "D", 3),
      stringDef("g3", "G", 3),
      stringDef("b3", "B", 3),
      stringDef("e4", "E", 4),
    ],
  },
  {
    id: "dadgad",
    name: "DADGAD",
    short: "DADGAD",
    preferFlats: false,
    strings: [
      stringDef("d2", "D", 2),
      stringDef("a2", "A", 2),
      stringDef("d3", "D", 3),
      stringDef("g3", "G", 3),
      stringDef("a3", "A", 3),
      stringDef("d4", "D", 4),
    ],
  },
  {
    id: "open-g",
    name: "Open G",
    short: "DGDGBD",
    preferFlats: false,
    strings: [
      stringDef("d2", "D", 2),
      stringDef("g2", "G", 2),
      stringDef("d3", "D", 3),
      stringDef("g3", "G", 3),
      stringDef("b3", "B", 3),
      stringDef("d4", "D", 4),
    ],
  },
  {
    id: "open-d",
    name: "Open D",
    short: "DADF♯AD",
    preferFlats: false,
    strings: [
      stringDef("d2", "D", 2),
      stringDef("a2", "A", 2),
      stringDef("d3", "D", 3),
      stringDef("fs3", "F♯", 3),
      stringDef("a3", "A", 3),
      stringDef("d4", "D", 4),
    ],
  },
  {
    id: "half-step",
    name: "Half-step down",
    short: "E♭A♭D♭G♭B♭E♭",
    preferFlats: true,
    strings: [
      stringDef("eb2", "E♭", 2),
      stringDef("ab2", "A♭", 2),
      stringDef("db3", "D♭", 3),
      stringDef("gb3", "G♭", 3),
      stringDef("bb3", "B♭", 3),
      stringDef("eb4", "E♭", 4),
    ],
  },
];

export function closestString(frequency, strings) {
  let best = strings[0];
  let bestAbs = Infinity;
  for (const s of strings) {
    const cents = Math.abs(1200 * Math.log2(frequency / s.hz));
    if (cents < bestAbs) {
      bestAbs = cents;
      best = s;
    }
  }
  return { string: best, centsAbs: bestAbs };
}
