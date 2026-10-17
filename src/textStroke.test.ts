import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// A text outline (-webkit-text-stroke) paints half its width outside each letter. On text
// that clips (overflow: hidden, for ellipsis) with no left padding, the first letter's outline
// is cut off: every menu title's first letter lost its left edge that way. Any selector with an
// outline and a clip must keep at least half the outline as left padding.
type Rule = { stroke: number; clips: boolean; padLeft: number | null }

function px(v: string): number {
  const m = v.trim().match(/^(-?[\d.]+)px$/)
  return m ? parseFloat(m[1]) : v.trim() === '0' ? 0 : NaN
}

// padding shorthand: 1 value = all, 2 = block inline, 3/4 = left is the 2nd/4th
function leftOf(padding: string): number {
  const parts = padding.trim().split(/\s+/)
  return px(parts.length === 4 ? parts[3] : parts.length === 1 ? parts[0] : parts[1])
}

function clipped(sheets: string[]): string[] {
  const out = new Map<string, Rule>()
  for (const sheet of sheets) {
    const css = sheet.replace(/\/\*[\s\S]*?\*\//g, '')
    // innermost blocks only: "selector { declarations }" with no nested braces
    for (const [, sel, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (sel.trim().startsWith('@') || /^\s*(from|to|[\d.]+%)\s*$/.test(sel)) continue
      for (const raw of sel.split(',')) {
        const key = raw.replace(/:root(\.[\w-]+)*\s+/g, '').replace(/\s+/g, ' ').trim()
        if (!key) continue
        const r = out.get(key) ?? { stroke: 0, clips: false, padLeft: null }
        for (const decl of body.split(';')) {
          const i = decl.indexOf(':')
          if (i < 0) continue
          const prop = decl.slice(0, i).trim()
          const val = decl.slice(i + 1).trim()
          if (prop === '-webkit-text-stroke') r.stroke = Math.max(r.stroke, px(val.split(/\s+/)[0]) || 0)
          else if (prop === '-webkit-text-stroke-width') r.stroke = Math.max(r.stroke, px(val) || 0)
          else if ((prop === 'overflow' || prop === 'overflow-x') && /hidden|clip/.test(val)) r.clips = true
          else if (prop === 'padding' || prop === 'padding-left' || prop === 'padding-inline' || prop === 'padding-inline-start') {
            const left = prop === 'padding' ? leftOf(val) : prop === 'padding-inline' ? px(val.split(/\s+/)[0]) : px(val)
            // the smallest left padding any screen size gets is the one that counts
            if (!Number.isNaN(left)) r.padLeft = r.padLeft === null ? left : Math.min(r.padLeft, left)
          }
        }
        out.set(key, r)
      }
    }
  }
  return [...out].filter(([, r]) => r.stroke > 0 && r.clips && (r.padLeft ?? 0) < r.stroke / 2)
    .map(([sel, r]) => `${sel}: ${r.stroke}px outline, ${r.padLeft ?? 0}px left padding`)
}

const src = new URL('./', import.meta.url)
const sheets = (readdirSync(src, { recursive: true }) as string[]).filter((f) => f.endsWith('.css')).map((f) => readFileSync(new URL(f, src), 'utf8'))

describe('outlined text', () => {
  it('keeps room for the first letter outline wherever it clips', () => {
    expect(clipped(sheets)).toEqual([])
  })

  it('catches the clipped menu title', () => {
    const before = '.panel-head h2 { overflow: hidden; } @media (max-width: 600px) { :root .panel-head h2 { padding: 2px 4px 4px 0; -webkit-text-stroke: 6px #000; } }'
    expect(clipped([before])).toEqual(['.panel-head h2: 6px outline, 0px left padding'])
    expect(clipped([before.replace('4px 4px 0', '4px 4px')])).toEqual([])
  })
})
