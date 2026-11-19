import { chromium } from 'playwright'
const out = process.argv[2]
const q = process.argv[3] ?? 'time=0.5&weather=clear&season=fall'
const forms = (process.argv[4] ?? 'desktop,phone').split(',')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
for (const form of forms) {
  const size = form === 'phone' ? { width: 390, height: 844 } : { width: 1280, height: 800 }
  const p = await b.newPage({ viewport: size, deviceScaleFactor: form === 'phone' ? 2 : 1 })
  p.on('pageerror', (e) => console.log('error', e.message))
  p.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text().slice(0, 300)) })
  await p.addInitScript(() => { localStorage.setItem('cartopia-flash-warning-hide', '1'); localStorage.setItem('cartopia-calm-flash', 'off') })
  await p.goto('http://localhost:5173/?' + q)
  await p.waitForFunction(() => window.__game, null, { timeout: 120000 })
  await p.waitForTimeout(2500)
  await p.evaluate(() => window.__game.setState({ tutorial: 99, level: 20, panel: null }))
  await p.waitForTimeout(1000)
  await p.evaluate(() => window.__game.setState({ panel: null }))
  await p.evaluate(async () => (await import('/src/scene/freeCam.ts')).setFreeCam(true))
  await p.waitForTimeout(6000)
  // Aim the camera at the sky by hand: az is measured from the cosmos front
  // (where the planets gather), el is the look-up angle in degrees.
  await p.evaluate(async () => {
    const url = performance.getEntriesByType('resource').map((e) => e.name).find((n) => n.includes('@react-three_fiber.js'))
    const m = await import(url)
    const { A_CITY } = await import('/src/scene/horizonLand.ts')
    const roots = [...m._roots.values()].map((r) => r.store.getState()).filter((s) => s.camera.isPerspectiveCamera)
    const st = roots[0]
    const render = st.gl.render.bind(st.gl)
    window.__aim = { az: 0, el: 20, fov: 55 }
    st.gl.render = (scene, cam) => {
      const a = A_CITY - 1.1 + window.__aim.az, e = (window.__aim.el * Math.PI) / 180
      cam.fov = window.__aim.fov
      cam.updateProjectionMatrix()
      cam.lookAt(cam.position.x + Math.cos(a) * Math.cos(e), cam.position.y + Math.sin(e), cam.position.z + Math.sin(a) * Math.cos(e))
      render(scene, cam)
    }
  })
  for (const [name, az, el, fov] of JSON.parse(process.env.AIMS ?? '[["front",-0.1,22,70],["mw",0.6,45,80],["planets",-0.3,15,40],["galaxy",0.32,15,30]]')) {
    await p.evaluate(([az, el, fov]) => { window.__aim = { az, el, fov }; window.__game.setState({ panel: null }) }, [az, el, fov])
    await p.waitForTimeout(2500)
    await p.screenshot({ path: `${out}/${form}-${name}.png` })
    console.log(form, name)
  }
  await p.close()
}
await b.close()
