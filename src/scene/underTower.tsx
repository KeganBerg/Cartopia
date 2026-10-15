import { createContext, useContext, type ReactNode } from 'react'

// True while a level 1 shop is drawn as the podium of its grown tower (ShopTower):
// anything standing on its roof would end up inside the tower's walls.
export const UnderTower = createContext(false)

// Draws its children only on a shop whose roof is open to the sky.
export function OpenRoof({ children }: { children: ReactNode }) {
  return useContext(UnderTower) ? null : <>{children}</>
}
