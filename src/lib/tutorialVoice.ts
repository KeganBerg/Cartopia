// The tutorial's spoken lines (public/audio/tutorial/, ~40 KB each). Each one is
// fetched only when its step comes up, plays through the master output so Sound
// off, the volume and a hidden tab apply to it, and stops when the step changes,
// the tutorial ends or the sound is switched off. A line that finished is not said again.
import { audioContext, audioOut, isMuted, onMuteChange } from './sound'

export const VOICE_LINES = [
  '01-welcome', '02-pizza-job', '03-collect', '04-build-shop', '05-build-lot-tap', '06-build-lot-click',
  '07-built-find', '08-find-cars', '09-restore', '10-paint-rims', '11-gas', '12-first-race',
] as const
export type VoiceLine = (typeof VOICE_LINES)[number]
export const voiceUrl = (id: VoiceLine) => `/audio/tutorial/${id}.mp3`

const buffers = new Map<VoiceLine, Promise<AudioBuffer | null>>()
const said = new Set<VoiceLine>()
let want: VoiceLine | null = null
let playing: AudioBufferSourceNode | null = null

function load(c: BaseAudioContext, id: VoiceLine) {
  let p = buffers.get(id)
  if (!p) {
    p = fetch(voiceUrl(id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((b) => c.decodeAudioData(b))
      .catch(() => {
        buffers.delete(id)
        return null
      })
    buffers.set(id, p)
  }
  return p
}

function stop() {
  const src = playing
  playing = null
  try {
    src?.stop()
  } catch {
    /* already stopped */
  }
}

function start() {
  const id = want
  if (!id || said.has(id) || playing) return
  // Muted: nothing to say, and nothing downloaded.
  const c = audioContext()
  if (!c || isMuted()) return
  void load(c, id).then((b) => {
    const out = audioOut()
    if (!b || !out || want !== id || playing || said.has(id) || isMuted()) return
    const src = c.createBufferSource()
    src.buffer = b
    src.connect(out)
    src.onended = () => {
      if (playing !== src) return
      playing = null
      said.add(id)
    }
    playing = src
    src.start()
  })
}

// The line for what's on screen now, or null for none: a new line cuts off the old one.
export function sayLine(id: VoiceLine | null) {
  if (id === want) return
  want = id
  stop()
  start()
}

onMuteChange(() => {
  if (isMuted()) stop()
  else start()
})
