// ── Web Audio API procedural sound manager ──────────────────────────────────
// No audio files — all sounds synthesized at runtime

export default class SoundManager {
  constructor() {
    this.ctx = null
    this.master = null
    this.muted = false
    this.musicInterval = null
    this.musicGain = null
  }

  _init() {
    if (this.ctx) return
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()
    this.master = this.ctx.createGain()
    this.master.connect(this.ctx.destination)
  }

  resume() {
    this._init()
    if (this.ctx.state === 'suspended') this.ctx.resume()
  }

  setMuted(val) {
    this.muted = val
    if (this.master) this.master.gain.value = val ? 0 : 1
  }

  toggleMute() {
    this.setMuted(!this.muted)
    return this.muted
  }

  // ── Helpers ──

  _tone(freq, duration, type = 'sine', volume = 0.3) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, t)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + duration)
  }

  _sweep(startFreq, endFreq, duration, type = 'sine', volume = 0.3) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const osc = this.ctx.createOscillator()
    const gain = this.ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(startFreq, t)
    osc.frequency.exponentialRampToValueAtTime(endFreq, t + duration)
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    osc.connect(gain)
    gain.connect(this.master)
    osc.start(t)
    osc.stop(t + duration)
  }

  _noise(duration, volume = 0.15) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const len = this.ctx.sampleRate * duration
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const data = buf.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(volume, t)
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration)
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.setValueAtTime(1000, t)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.master)
    src.start(t)
    src.stop(t + duration)
    return filter
  }

  // ── Sound effects ──

  playPass() {
    if (!this.ctx) return
    // Quick ascending whoosh
    const t = this.ctx.currentTime
    const filter = this._noise(0.15, 0.12)
    if (filter) {
      filter.frequency.setValueAtTime(300, t)
      filter.frequency.exponentialRampToValueAtTime(3000, t + 0.12)
    }
    this._sweep(400, 1200, 0.12, 'sine', 0.1)
  }

  playShapeChange() {
    // Short click/pop
    this._tone(800, 0.06, 'sine', 0.15)
    this._tone(1200, 0.04, 'sine', 0.08)
  }

  playNearMiss() {
    // Zing — ascending sweep
    this._sweep(1200, 2800, 0.2, 'sine', 0.2)
    this._sweep(600, 1400, 0.15, 'triangle', 0.08)
  }

  playDeath() {
    if (!this.ctx) return
    // Low boom + noise burst
    this._tone(60, 0.5, 'sine', 0.4)
    this._tone(45, 0.6, 'sine', 0.3)
    this._noise(0.4, 0.25)
    this._sweep(200, 40, 0.4, 'sawtooth', 0.1)
  }

  playComboBreak() {
    if (!this.ctx) return
    this._sweep(800, 200, 0.25, 'sawtooth', 0.15)
    this._tone(150, 0.2, 'square', 0.1)
  }

  playMilestone() {
    if (!this.ctx) return
    // Ascending chime: C5 → E5 → G5
    const t = this.ctx.currentTime
    const notes = [523, 659, 784]
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t + i * 0.1)
      gain.gain.linearRampToValueAtTime(0.2, t + i * 0.1 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.3)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t + i * 0.1)
      osc.stop(t + i * 0.1 + 0.35)
    })
  }

  playLevelUp() {
    if (!this.ctx) return
    // Ascending arpeggio: C5 → E5 → G5 → C6
    const t = this.ctx.currentTime
    const notes = [523, 659, 784, 1047]
    notes.forEach((freq, i) => {
      const osc = this.ctx.createOscillator()
      const gain = this.ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(freq, t)
      gain.gain.setValueAtTime(0, t + i * 0.08)
      gain.gain.linearRampToValueAtTime(0.25, t + i * 0.08 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.4)
      osc.connect(gain)
      gain.connect(this.master)
      osc.start(t + i * 0.08)
      osc.stop(t + i * 0.08 + 0.45)
    })
  }

  // ── Background music (procedural beat loop) ──

  startMusic(bpm = 120) {
    if (!this.ctx) return
    this.stopMusic()
    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.08
    this.musicGain.connect(this.master)

    let beat = 0
    const tick = () => {
      if (!this.ctx || !this.musicGain) return
      const t = this.ctx.currentTime

      // Kick on beats 0, 2
      if (beat % 4 === 0 || beat % 4 === 2) {
        const osc = this.ctx.createOscillator()
        const g = this.ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(80, t)
        osc.frequency.exponentialRampToValueAtTime(30, t + 0.1)
        g.gain.setValueAtTime(1, t)
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.12)
        osc.connect(g)
        g.connect(this.musicGain)
        osc.start(t)
        osc.stop(t + 0.15)
      }

      // Hi-hat on every beat
      const len = this.ctx.sampleRate * 0.04
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
      const src = this.ctx.createBufferSource()
      src.buffer = buf
      const hg = this.ctx.createGain()
      const hf = this.ctx.createBiquadFilter()
      hf.type = 'highpass'
      hf.frequency.value = 7000
      hg.gain.setValueAtTime(beat % 4 === 0 ? 0.6 : 0.3, t)
      hg.gain.exponentialRampToValueAtTime(0.001, t + 0.05)
      src.connect(hf)
      hf.connect(hg)
      hg.connect(this.musicGain)
      src.start(t)
      src.stop(t + 0.06)

      beat++
    }

    tick()
    this._musicBpm = bpm
    this.musicInterval = setInterval(tick, (60 / bpm) * 1000 / 2) // 8th notes
  }

  setMusicTempo(bpm) {
    if (!this.musicInterval || bpm === this._musicBpm) return
    this.startMusic(bpm)
  }

  stopMusic() {
    if (this.musicInterval) {
      clearInterval(this.musicInterval)
      this.musicInterval = null
    }
    if (this.musicGain) {
      try { this.musicGain.disconnect() } catch (_) {}
      this.musicGain = null
    }
  }
}
