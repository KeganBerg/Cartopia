// The Car Packs menu on its own, for check.mjs to measure every card and the showcase.
import { createRoot } from 'react-dom/client'
import '../../src/index.css'
import { CarPacksPanel } from '../../src/ui/CarPacks'
import { ThumbRenderer } from '../../src/scene/BuildingPreview'

createRoot(document.getElementById('root')!).render(
  <>
    <ThumbRenderer />
    <CarPacksPanel />
  </>,
)
