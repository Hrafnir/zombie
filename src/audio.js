(() => {
  "use strict";

  const EM = window.EM;

  const Audio = {
    ctx: null,
    master: null,
    unlocked: false,
    lastPlayed: new Map(),
  };

  function getCtx() {
    if (!Audio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;

      Audio.ctx = new Ctx();

      Audio.master = Audio.ctx.createGain();
      Audio.master.gain.value = 0.23;
      Audio.master.connect(Audio.ctx.destination);
    }

    return Audio.ctx;
  }

  function unlock() {
    const ctx = getCtx();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    Audio.unlocked = true;
  }

  function throttle(name, ms = 45) {
    const now = performance.now();
    const last = Audio.lastPlayed.get(name) || 0;

    if (now - last < ms) return false;

    Audio.lastPlayed.set(name, now);
    return true;
  }

  function osc({ type = "sine", freq = 440, endFreq = null, duration = 0.12, gain = 0.15, attack = 0.005 }) {
    const ctx = getCtx();
    if (!ctx || !Audio.unlocked) return;

    const t = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const amp = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, t);

    if (endFreq !== null) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + duration);
    }

    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(gain, t + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    oscillator.connect(amp);
    amp.connect(Audio.master);

    oscillator.start(t);
    oscillator.stop(t + duration + 0.03);
  }

  function noise({ duration = 0.12, gain = 0.12, filter = 900, type = "bandpass" }) {
    const ctx = getCtx();
    if (!ctx || !Audio.unlocked) return;

    const t = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = ctx.createBufferSource();
    const filterNode = ctx.createBiquadFilter();
    const amp = ctx.createGain();

    source.buffer = buffer;
    filterNode.type = type;
    filterNode.frequency.value = filter;

    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + duration);

    source.connect(filterNode);
    filterNode.connect(amp);
    amp.connect(Audio.master);

    source.start(t);
    source.stop(t + duration + 0.02);
  }

  function chord(freqs, duration = 0.2, gain = 0.08) {
    for (const freq of freqs) {
      osc({ type: "triangle", freq, duration, gain });
    }
  }

  EM.sfx = function sfx(name) {
    unlock();

    if (!throttle(name)) return;

    switch (name) {
      case "start":
        chord([220, 330, 440], 0.18, 0.07);
        setTimeout(() => chord([330, 440, 660], 0.22, 0.06), 90);
        break;

      case "newDay":
        chord([196, 294, 392], 0.35, 0.08);
        setTimeout(() => osc({ type: "sine", freq: 392, endFreq: 784, duration: 0.25, gain: 0.06 }), 120);
        break;

      case "pause":
        osc({ type: "triangle", freq: 330, endFreq: 180, duration: 0.12, gain: 0.07 });
        break;

      case "resume":
        osc({ type: "triangle", freq: 180, endFreq: 330, duration: 0.12, gain: 0.07 });
        break;

      case "click":
        osc({ type: "square", freq: 520, endFreq: 620, duration: 0.035, gain: 0.035 });
        break;

      case "empty":
        osc({ type: "sawtooth", freq: 120, endFreq: 70, duration: 0.11, gain: 0.05 });
        break;

      case "pickup":
        osc({ type: "triangle", freq: 550, endFreq: 980, duration: 0.09, gain: 0.055 });
        break;

      case "water":
        osc({ type: "sine", freq: 620, endFreq: 420, duration: 0.14, gain: 0.04 });
        noise({ duration: 0.08, gain: 0.025, filter: 1600, type: "highpass" });
        break;

      case "wood":
        noise({ duration: 0.08, gain: 0.09, filter: 520, type: "bandpass" });
        osc({ type: "triangle", freq: 170, endFreq: 110, duration: 0.08, gain: 0.04 });
        break;

      case "stone":
        noise({ duration: 0.07, gain: 0.11, filter: 1600, type: "bandpass" });
        osc({ type: "square", freq: 210, endFreq: 90, duration: 0.055, gain: 0.035 });
        break;

      case "melee":
        noise({ duration: 0.055, gain: 0.075, filter: 1100, type: "bandpass" });
        osc({ type: "sawtooth", freq: 260, endFreq: 130, duration: 0.065, gain: 0.035 });
        break;

      case "shootLight":
        noise({ duration: 0.055, gain: 0.12, filter: 2200, type: "highpass" });
        osc({ type: "square", freq: 700, endFreq: 220, duration: 0.055, gain: 0.035 });
        break;

      case "shootHeavy":
        noise({ duration: 0.13, gain: 0.18, filter: 700, type: "lowpass" });
        osc({ type: "sawtooth", freq: 130, endFreq: 55, duration: 0.15, gain: 0.08 });
        break;

      case "hitZombie":
        noise({ duration: 0.08, gain: 0.1, filter: 680, type: "bandpass" });
        osc({ type: "sawtooth", freq: 95, endFreq: 55, duration: 0.11, gain: 0.05 });
        break;

      case "hurt":
        osc({ type: "sawtooth", freq: 140, endFreq: 70, duration: 0.18, gain: 0.08 });
        noise({ duration: 0.12, gain: 0.08, filter: 450, type: "lowpass" });
        break;

      case "dodge":
        noise({ duration: 0.09, gain: 0.055, filter: 1200, type: "highpass" });
        break;

      case "gameOver":
        osc({ type: "sawtooth", freq: 220, endFreq: 110, duration: 0.28, gain: 0.08 });
        setTimeout(() => osc({ type: "sawtooth", freq: 146, endFreq: 73, duration: 0.34, gain: 0.07 }), 160);
        setTimeout(() => osc({ type: "sine", freq: 98, endFreq: 49, duration: 0.42, gain: 0.06 }), 320);
        break;

      default:
        osc({ type: "sine", freq: 440, duration: 0.08, gain: 0.04 });
    }
  };

  function installGlobalUnlock() {
    const events = ["pointerdown", "keydown", "touchstart"];

    for (const eventName of events) {
      window.addEventListener(eventName, unlock, { once: false, passive: true });
    }
  }

  installGlobalUnlock();
})();
