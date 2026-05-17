/* ═══════════════════════════════════════════════════════════════════
   sound.js — Web Audio API sound effects
═══════════════════════════════════════════════════════════════════ */

const Sound = (() => {
  let ctx = null;

  function _ctx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function _tone(freq, type, startVol, duration, delay = 0) {
    const ac = _ctx();
    const osc  = ac.createOscillator();
    const gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type;
    osc.frequency.value = freq;
    const t = ac.currentTime + delay;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(startVol, t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.start(t);
    osc.stop(t + duration + 0.01);
  }

  function correctGuess() {
    _tone(523, 'sine', 0.28, 0.12, 0.00);
    _tone(659, 'sine', 0.28, 0.12, 0.09);
    _tone(784, 'sine', 0.28, 0.14, 0.18);
    _tone(1047,'sine', 0.32, 0.28, 0.27);
  }

  function timerTick() {
    _tone(280, 'square', 0.06, 0.06, 0);
  }

  function roundStart() {
    _tone(392, 'triangle', 0.22, 0.18, 0.00);
    _tone(523, 'triangle', 0.22, 0.18, 0.14);
    _tone(659, 'triangle', 0.22, 0.18, 0.28);
    _tone(784, 'triangle', 0.30, 0.38, 0.42);
  }

  function turnOver() {
    _tone(523, 'sine', 0.22, 0.16, 0.00);
    _tone(440, 'sine', 0.22, 0.16, 0.13);
    _tone(349, 'sine', 0.22, 0.30, 0.26);
  }

  function joinPing() {
    _tone(660, 'sine', 0.18, 0.20, 0.00);
    _tone(880, 'sine', 0.18, 0.18, 0.12);
  }

  return { correctGuess, timerTick, roundStart, turnOver, joinPing };
})();
