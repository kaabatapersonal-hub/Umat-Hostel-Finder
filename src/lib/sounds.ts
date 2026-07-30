// App-wide UI sound effects, synthesized with the Web Audio API rather
// than shipped as audio files -- keeps the bundle small and avoids
// hosting/loading .mp3s for four short (<500ms) effects.
//
// Usage: playSound("like") from any client component, on a deliberate
// user action only (never on navigation, tab switches, or passive
// scrolling). Silently does nothing if Web Audio is unavailable, or if
// the browser hasn't seen a user gesture yet (autoplay restrictions) --
// by the time a user taps something that plays a sound, they've already
// interacted, so this is only ever a non-issue in practice.

export type SoundName = "like" | "save" | "send" | "success";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (audioContext) return audioContext;
  // Created lazily on first actual playSound call, not at module load --
  // some browsers penalize/warn on an eagerly-created AudioContext before
  // any user gesture has happened.
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  audioContext = new Ctor();
  return audioContext;
}

function envelope(gainNode: GainNode, ctx: AudioContext, attack: number, peak: number, releaseEnd: number, peakLevel: number) {
  const now = ctx.currentTime;
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(peakLevel, now + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + peak + releaseEnd);
}

// Quick bright pop with a slight upward pitch bend -- a "sparkle."
function playLike(ctx: AudioContext) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(880, now);
  osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);
  envelope(gain, ctx, 0.008, 0.02, 0.14, 0.35);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Soft camera-shutter click -- a short filtered noise burst with a sharp
// attack and fast decay, a "snap."
function playSave(ctx: AudioContext) {
  const now = ctx.currentTime;
  const duration = 0.05;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 2500;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration);
}

// Filtered noise sweep, low frequency to high, over ~200ms -- a "whoosh"
// for something just having been sent off.
function playSend(ctx: AudioContext) {
  const now = ctx.currentTime;
  const duration = 0.2;
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.7;
  filter.frequency.setValueAtTime(300, now);
  filter.frequency.exponentialRampToValueAtTime(4000, now + duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration);
}

// Two-note ascending chime -- C5 then E5, a "done."
function playSuccess(ctx: AudioContext) {
  const now = ctx.currentTime;

  function note(freq: number, startAt: number, duration: number) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.3, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(startAt);
    osc.stop(startAt + duration + 0.02);
  }

  note(523, now, 0.08);
  note(659, now + 0.08, 0.12);
}

const PLAYERS: Record<SoundName, (ctx: AudioContext) => void> = {
  like: playLike,
  save: playSave,
  send: playSend,
  success: playSuccess,
};

// Never throws -- a failed/unsupported sound effect must never break the
// action it's celebrating.
export function playSound(name: SoundName): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      // Best-effort -- if this rejects (no user gesture yet), the catch
      // below swallows it silently, same as everything else here.
      void ctx.resume();
    }
    PLAYERS[name](ctx);
  } catch {
    // Silent no-op -- Web Audio issues should never surface to the user.
  }
}
