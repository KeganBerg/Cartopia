import { useState } from 'react'
import { stageSnapshot } from '../scene/Stage'
import { useGame } from '../game/store'
import { gameLink } from '../lib/invite'

// The snapshot button on a won race: a picture of the race as it stands, with a
// winner's strip along the bottom, shared from a phone or saved on a computer.

async function postcard(shot: Blob, caption: string): Promise<Blob | null> {
  const img = await createImageBitmap(shot)
  const strip = Math.round(img.height * 0.11)
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height + strip
  const g = c.getContext('2d')
  if (!g) return shot
  g.drawImage(img, 0, 0)
  g.fillStyle = '#1b2440'
  g.fillRect(0, img.height, c.width, strip)
  g.fillStyle = '#ffd54f'
  g.font = `800 ${Math.round(strip * 0.42)}px system-ui, sans-serif`
  g.textBaseline = 'middle'
  g.fillText(caption, strip * 0.4, img.height + strip / 2)
  g.fillStyle = '#ffffff'
  g.textAlign = 'right'
  g.font = `700 ${Math.round(strip * 0.32)}px system-ui, sans-serif`
  g.fillText('cartopia.lol', c.width - strip * 0.4, img.height + strip / 2)
  return new Promise((done) => c.toBlob(done, 'image/jpeg', 0.9))
}

export function SnapshotButton({ caption }: { caption: string }) {
  const [busy, setBusy] = useState(false)
  const take = async () => {
    if (busy) return
    setBusy(true)
    try {
      const shot = await stageSnapshot()
      const card = shot && (await postcard(shot, caption))
      if (!card) return useGame.getState().toast('No picture this time')
      const file = new File([card], `cartopia-${Date.now()}.jpg`, { type: 'image/jpeg' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${caption} ${gameLink('share')}` }).catch(() => {})
        return
      }
      const url = URL.createObjectURL(card)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
      useGame.getState().toast('📸 Saved')
    } finally {
      setBusy(false)
    }
  }
  return (
    <button className="snap-btn" onClick={take} disabled={busy} aria-label="Snapshot">📸</button>
  )
}
