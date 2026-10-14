import { ShaderChunk } from 'three'

// Big black boxes flashing across the screen: the town draws into a half-float
// buffer before the glow (bloom) and colour grade. A single pixel brighter than
// a half float can hold (a mirror-smooth glint catching the sun at just the
// right angle) is stored as infinity, and a broken bit of maths gives NaN. The
// glow's blur then shrinks the frame and grows it back, smearing that one bad
// pixel into blocks dozens of pixels wide, which come out black, for as long
// as the glint lasts. Every material (three's own and our shaders, which all
// end with this chunk) now hands on a finite colour: NaN becomes black for that
// one pixel and anything brighter than SAFE is held at SAFE (still pure white
// after tone mapping, and a glint no longer flares across half the screen).
export const SAFE = 1024.0

// (A select, not mix(): NaN times nought is still NaN.)
export const SAFE_COLOR = /* glsl */ `
{
  bvec4 nanc = isnan(gl_FragColor);
  gl_FragColor = vec4(nanc.x ? 0.0 : gl_FragColor.x, nanc.y ? 0.0 : gl_FragColor.y, nanc.z ? 0.0 : gl_FragColor.z, nanc.w ? 0.0 : gl_FragColor.w);
  gl_FragColor = clamp(gl_FragColor, vec4(-${SAFE.toFixed(1)}), vec4(${SAFE.toFixed(1)}));
}
`

if (!ShaderChunk.colorspace_fragment.includes('nanc')) ShaderChunk.colorspace_fragment += SAFE_COLOR
