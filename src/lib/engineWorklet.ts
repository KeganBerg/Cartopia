// A combustion-pulse engine, run on the audio thread. Instead of a steady tone, every
// cylinder firing is its own pressure pulse with a little random variation, pushed
// through an exhaust pipe (a feedback delay) and a muffler. That irregular, physical
// pulse train is what makes it sound like an engine rather than a synthesizer.

export type PulseConfig = {
  intervals: number[] // firing gaps as multiples of the average (uneven V8s, V-twins)
  weights: number[] // pulse strength per cylinder
  jitter: number // random variation per firing, 0-1
  width: number // pulse length as a fraction of the firing gap
  rough: number // combustion noise in each pulse, 0-1
  pipe: number // exhaust pipe delay, seconds
  feedback: number // how strongly the pipe rings, 0-1
}

const SOURCE = `
class EnginePulse extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'freq', defaultValue: 20, minValue: 1, maxValue: 2000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
    ]
  }
  constructor(o) {
    super()
    const c = o.processorOptions
    this.c = c
    this.idx = 0
    this.wait = 0
    this.pulses = []
    const n = Math.ceil(sampleRate * 0.03)
    this.buf = new Float32Array(n)
    this.w = 0
    this.lpz = 0
    this.dcx = 0
    this.dcy = 0
    this.mz = 0
    this.alive = true
    this.port.onmessage = (e) => { if (e.data === 'stop') this.alive = false }
  }
  rnd() {
    return (Math.random() + Math.random() + Math.random() - 1.5) * 0.8
  }
  process(_in, outs, params) {
    const out = outs[0][0]
    const c = this.c
    const f = params.freq[0]
    const thr = params.throttle[0]
    const gap = sampleRate / f
    const pipeLen = Math.min(this.buf.length - 1, Math.max(8, Math.round(c.pipe * sampleRate)))
    const n = this.buf.length
    // Muffler: darker off the throttle.
    const mk = Math.exp(-2 * Math.PI * (500 + 2800 * thr) / sampleRate)
    for (let i = 0; i < out.length; i++) {
      if (this.wait <= 0) {
        const k = this.idx % c.intervals.length
        const amp = c.weights[this.idx % c.weights.length] * (0.45 + 0.55 * thr) * (1 + c.jitter * this.rnd())
        const len = Math.max(sampleRate * 0.0012, Math.min(sampleRate * 0.012, gap * c.width))
        if (this.pulses.length < 6) this.pulses.push({ age: 0, len, amp })
        this.wait += gap * c.intervals[k] * (1 + c.jitter * 0.04 * this.rnd())
        this.idx++
      }
      this.wait--
      let x = 0
      for (let p = this.pulses.length - 1; p >= 0; p--) {
        const q = this.pulses[p]
        const u = q.age / q.len
        if (u >= 1.6) { this.pulses.splice(p, 1); continue }
        // Pressure spike then a smaller rarefaction swing, with combustion roughness.
        const shape = u < 1 ? Math.sin(Math.PI * u) : -0.35 * Math.sin(Math.PI * (u - 1) / 0.6)
        x += q.amp * shape * (1 + c.rough * (Math.random() * 2 - 1) * (u < 1 ? 1 - u : 0.3))
        q.age++
      }
      // Exhaust pipe: the reflected wave comes back after the pipe delay, damped.
      const r = this.w - pipeLen
      const back = this.buf[(r + n) % n]
      this.lpz = back + (this.lpz - back) * 0.55
      const y = x + c.feedback * this.lpz
      this.buf[this.w] = y
      this.w = (this.w + 1) % n
      // Muffler lowpass and a DC blocker.
      this.mz = y + (this.mz - y) * mk
      const d = this.mz - this.dcx + 0.995 * this.dcy
      this.dcx = this.mz
      this.dcy = d
      out[i] = d * 0.5
    }
    return this.alive
  }
}
registerProcessor('engine-pulse', EnginePulse)
`

const loaded = new WeakMap<BaseAudioContext, Promise<boolean>>()
const ready = new WeakSet<BaseAudioContext>()

// Load the processor once per context; the race starts the load as the screen opens.
export function loadEngineWorklet(a: BaseAudioContext) {
  let p = loaded.get(a)
  if (!p) {
    p = (async () => {
      try {
        if (!a.audioWorklet) return false
        const url = URL.createObjectURL(new Blob([SOURCE], { type: 'application/javascript' }))
        await a.audioWorklet.addModule(url)
        URL.revokeObjectURL(url)
        ready.add(a)
        return true
      } catch {
        return false
      }
    })()
    loaded.set(a, p)
  }
  return p
}
export const engineWorkletReady = (a: BaseAudioContext) => ready.has(a)
