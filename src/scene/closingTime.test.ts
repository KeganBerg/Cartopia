// @vitest-environment jsdom
import './testCanvas'
import { describe, expect, it } from 'vitest'
import { MeshStandardMaterial, ShaderLib, type Material } from 'three'
import { closingGlow, signMat } from './closingTime'

// Lights out pane by pane (closingTime.ts) picks each pane's closing time
// with a hash of the building's seeds. A hash turns the tiniest change into a
// different answer, so its inputs must be the same on every pixel of a pane:
// seeds come in flat (not smoothed across the triangle), and the pane is found
// from the texture, not from the pixel. A smoothed seed wobbles in its last
// digits under the free camera's perspective and speckles dark panes white.

type Shader = { vertexShader: string; fragmentShader: string; uniforms: Record<string, { value: unknown }> }

function compile(m: Material, lib: { vertexShader: string; fragmentShader: string }) {
  const sh: Shader = { vertexShader: lib.vertexShader, fragmentShader: lib.fragmentShader, uniforms: {} }
  ;(m.onBeforeCompile as unknown as (s: Shader) => void)(sh)
  return sh
}

const smoothed = (src: string) => src.split('\n').filter((l) => /^\s*varying\b/.test(l) && /\bvHours\b/.test(l))

describe('closing-time lights', () => {
  it('reads the building seeds flat in the window and glass shader', () => {
    const sh = compile(closingGlow(new MeshStandardMaterial(), [4, 4], 'test', 0.3), ShaderLib.standard)
    for (const src of [sh.vertexShader, sh.fragmentShader]) {
      expect(src).toContain('flat varying vec3 vHours;')
      expect(smoothed(src)).toEqual([])
    }
    // One pane, one answer: the cell and its height come from the texture.
    expect(sh.fragmentShader).toContain('hoursLit(floor(hoursCell), vHoursY - (fract(hoursCell.y) - 0.5) * 0.300)')
  })

  it('reads the building seeds flat in the sign shader', () => {
    const sh = compile(signMat('TEST'), ShaderLib.basic)
    for (const src of [sh.vertexShader, sh.fragmentShader]) {
      expect(src).toContain('flat varying vec3 vHours;')
      expect(smoothed(src)).toEqual([])
    }
  })
})
