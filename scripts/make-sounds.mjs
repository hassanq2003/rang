// Generates the game's sound effects as small WAV files: node scripts/make-sounds.mjs
import { mkdirSync, writeFileSync } from 'node:fs';

const RATE = 22050;
const out = new URL('../assets/sounds/', import.meta.url);
mkdirSync(out, { recursive: true });

function wav(samples) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(RATE, 24); buf.writeUInt32LE(RATE * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32000), 44 + i * 2));
  return buf;
}

const len = (sec) => Math.floor(sec * RATE);
let seed = 7;
const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;

/** Bell-like tone: sine + soft overtone, exponential decay. */
function tone(freq, sec, { decay = 6, gain = 0.5, attack = 0.005 } = {}) {
  return Array.from({ length: len(sec) }, (_, i) => {
    const t = i / RATE;
    const env = Math.min(1, t / attack) * Math.exp(-decay * t);
    return gain * env * (Math.sin(2 * Math.PI * freq * t) + 0.3 * Math.sin(4 * Math.PI * freq * t));
  });
}

function mix(...tracks) {
  const n = Math.max(...tracks.map(([, s]) => s.length + 0));
  const total = Math.max(...tracks.map(([at, s]) => len(at) + s.length));
  const outS = new Array(Math.max(n, total)).fill(0);
  for (const [at, s] of tracks) s.forEach((v, i) => (outS[len(at) + i] += v));
  return outS;
}

/** Filtered noise burst, like a card hitting felt. */
function slap(sec, cutoff, gain) {
  let lp = 0;
  const a = Math.exp((-2 * Math.PI * cutoff) / RATE);
  return Array.from({ length: len(sec) }, (_, i) => {
    lp = a * lp + (1 - a) * noise();
    return gain * lp * Math.exp((-i / RATE) * 45) * 3;
  });
}

function swoosh(sec) {
  let lp = 0;
  return Array.from({ length: len(sec) }, (_, i) => {
    const t = i / sec / RATE;
    const a = Math.exp((-2 * Math.PI * (400 + 3000 * t)) / RATE);
    lp = a * lp + (1 - a) * noise();
    return 1.4 * lp * Math.sin(Math.PI * t);
  });
}

const sounds = {
  play: slap(0.12, 2500, 0.9),
  collect: swoosh(0.35),
  bank: mix([0, tone(880, 0.6)], [0.09, tone(1175, 0.6)], [0.18, tone(1760, 0.7, { gain: 0.35 })]),
  turn: tone(660, 0.35, { decay: 9, gain: 0.35 }),
  rang: mix([0, tone(523, 0.4)], [0.08, tone(659, 0.4)], [0.16, tone(784, 0.6)]),
  win: mix([0, tone(523, 0.5)], [0.14, tone(659, 0.5)], [0.28, tone(784, 0.5)], [0.42, tone(1047, 0.9, { decay: 3 })]),
  lose: mix([0, tone(392, 0.5, { decay: 4 })], [0.25, tone(311, 0.8, { decay: 3 })]),
  error: Array.from({ length: len(0.16) }, (_, i) => 0.25 * Math.sign(Math.sin((2 * Math.PI * 140 * i) / RATE)) * Math.exp((-i / RATE) * 12)),
};

for (const [name, s] of Object.entries(sounds)) writeFileSync(new URL(`${name}.wav`, out), wav(s));
console.log('wrote', Object.keys(sounds).join(', '));
