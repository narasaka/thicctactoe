import type { Size } from "@thicctactoe/game";
import { useSyncExternalStore } from "react";

import type { Sound } from "./sounds";

/**
 * Sound effects, synthesized with the Web Audio API so there are no files to
 * load. Browsers only allow audio after the user interacts with the page, so
 * the context starts on the first tap or key press; until then sounds are
 * dropped rather than queued up to all play at once.
 */

const MUTED_KEY = "thicctactoe:muted";

/** Seconds between sounds played together, e.g. a winning move and the fanfare. */
const SEQUENCE_GAP = 0.25;

let context: AudioContext | null = null;
let output: AudioNode | null = null;

function unlock() {
  if (!context) {
    context = new AudioContext();
    const volume = context.createGain();
    volume.gain.value = 0.6;
    // Overlapping sounds (a gobble, then a fanfare) must not clip.
    volume.connect(context.createDynamicsCompressor()).connect(context.destination);
    output = volume;
  }
  // Phones suspend audio in the background; any interaction brings it back.
  if (context.state !== "running") void context.resume();
}

if (typeof window !== "undefined") {
  for (const event of ["pointerdown", "keydown"]) {
    window.addEventListener(event, unlock, { capture: true, passive: true });
  }
}

/** Plays `sounds` one after another. */
export function playSounds(sounds: readonly Sound[]) {
  if (!context || !output || context.state !== "running" || isMuted()) return;
  for (const [index, sound] of sounds.entries()) {
    SYNTHS[sound.type](context, output, context.currentTime + index * SEQUENCE_GAP, sound);
  }
}

export function playSound(sound: Sound) {
  playSounds([sound]);
}

// Muting is remembered per browser and shared across tabs.

const listeners = new Set<() => void>();

function isMuted() {
  return localStorage.getItem(MUTED_KEY) === "1";
}

export function setMuted(muted: boolean) {
  if (muted) localStorage.setItem(MUTED_KEY, "1");
  else localStorage.removeItem(MUTED_KEY);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function useMuted() {
  return useSyncExternalStore(subscribe, isMuted, () => false);
}

// Synthesis.

type Synth = (context: AudioContext, output: AudioNode, at: number, sound: Sound) => void;

/** Bigger pieces sound lower. */
const PITCH: Record<Size, number> = { small: 1.25, medium: 1, large: 0.75 };

const sizeOf = (sound: Sound) => ("size" in sound ? sound.size : "medium");

/** A note that starts at `from` Hz, slides to `to` and dies away over `duration` seconds. */
function tone(
  context: AudioContext,
  output: AudioNode,
  at: number,
  {
    from,
    to = from,
    slide = 0.03,
    duration,
    gain,
    type = "sine",
  }: {
    from: number;
    to?: number;
    slide?: number;
    duration: number;
    gain: number;
    type?: OscillatorType;
  },
) {
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(from, at);
  if (to !== from) oscillator.frequency.exponentialRampToValueAtTime(to, at + slide);
  oscillator.connect(envelope(context, output, at, duration, gain));
  oscillator.start(at);
  oscillator.stop(at + duration + 0.05);
}

let noiseBuffer: AudioBuffer | null = null;

/** A burst of noise through a band-pass sweeping from `from` to `to` Hz: clicks and crunches. */
function noise(
  context: AudioContext,
  output: AudioNode,
  at: number,
  {
    from,
    to = from,
    duration,
    gain,
  }: { from: number; to?: number; duration: number; gain: number },
) {
  if (!noiseBuffer) {
    noiseBuffer = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
    const samples = noiseBuffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 1.5;
  filter.frequency.setValueAtTime(from, at);
  if (to !== from) filter.frequency.exponentialRampToValueAtTime(to, at + duration);
  source.connect(filter).connect(envelope(context, output, at, duration, gain));
  source.start(at);
  source.stop(at + duration + 0.05);
}

function envelope(
  context: AudioContext,
  output: AudioNode,
  at: number,
  duration: number,
  gain: number,
) {
  const node = context.createGain();
  node.gain.setValueAtTime(0.0001, at);
  node.gain.exponentialRampToValueAtTime(gain, at + 0.005);
  node.gain.exponentialRampToValueAtTime(0.0001, at + duration);
  node.connect(output);
  return node;
}

/** Notes of a short tune, `spacing` seconds apart; the last one rings longer. */
function melody(
  context: AudioContext,
  output: AudioNode,
  at: number,
  notes: readonly number[],
  spacing: number,
) {
  for (const [index, note] of notes.entries()) {
    const last = index === notes.length - 1;
    const start = at + index * spacing;
    const duration = last ? 0.6 : 0.25;
    tone(context, output, start, { from: note, duration, gain: 0.22, type: "triangle" });
    // A quiet octave above for some shimmer.
    tone(context, output, start, { from: note * 2, duration: duration / 2, gain: 0.05 });
  }
}

/** A wooden knock: a quick pitch drop and a click. */
const place: Synth = (context, output, at, sound) => {
  const size = sizeOf(sound);
  const pitch = 380 * PITCH[size];
  const ring = size === "large" ? 0.22 : 0.14;
  tone(context, output, at, { from: pitch * 1.8, to: pitch, duration: ring, gain: 0.5 });
  noise(context, output, at, { from: pitch * 6, duration: 0.03, gain: 0.3 });
  if (size === "large") tone(context, output, at, { from: 110, to: 60, duration: 0.2, gain: 0.35 });
};

const SYNTHS: Record<Sound["type"], Synth> = {
  /** A light tick as a piece leaves the tray. */
  pickup: (context, output, at, sound) => {
    const pitch = 1000 * PITCH[sizeOf(sound)];
    tone(context, output, at, { from: pitch, to: pitch * 1.4, duration: 0.06, gain: 0.08 });
  },
  place,
  /** The knock of the piece landing, a crunch, and a gulp as it swallows the one below. */
  gobble: (context, output, at, sound) => {
    place(context, output, at, sound);
    const pitch = PITCH[sizeOf(sound)];
    noise(context, output, at + 0.02, { from: 2500, to: 500, duration: 0.07, gain: 0.35 });
    noise(context, output, at + 0.1, { from: 2000, to: 400, duration: 0.06, gain: 0.25 });
    tone(context, output, at + 0.09, {
      from: 480 * pitch,
      to: 110 * pitch,
      slide: 0.18,
      duration: 0.22,
      gain: 0.3,
      type: "triangle",
    });
  },
  /** A low double bonk for a piece that does not fit there. */
  nope: (context, output, at) => {
    tone(context, output, at, { from: 196, duration: 0.08, gain: 0.25, type: "triangle" });
    tone(context, output, at + 0.1, { from: 165, duration: 0.12, gain: 0.25, type: "triangle" });
  },
  /** A doorbell: someone joined. */
  start: (context, output, at) => melody(context, output, at, [659, 880], 0.14),
  win: (context, output, at) => melody(context, output, at, [523, 659, 784, 1047], 0.09),
  lose: (context, output, at) => {
    melody(context, output, at, [392, 311], 0.18);
    tone(context, output, at + 0.36, {
      from: 262,
      to: 220,
      slide: 0.5,
      duration: 0.7,
      gain: 0.22,
      type: "triangle",
    });
  },
  draw: (context, output, at) => melody(context, output, at, [523, 392], 0.16),
};
