# Restyled car scans

Some cars use a body baked from an open-licensed 3D model instead of their body's procedural
shape. The model is cut into cross-sections, refitted to the Cartopia body it replaces (toy
proportions, our wheelbase and ride height, a longer hood, a narrower greenhouse), and saved as
a small loft in `src/scene/scans/<car id>.ts`. Windows, lights, trim, wheels and mods are our
own, drawn over it in `scanGeo` (`src/scene/CarModel.tsx`). The source model is never shipped.

## Adding one

1. Find a model whose licence allows changes and commercial use (CC0, or CC BY with credit).
   No real maker's name or logo comes with it, and the result must not copy the real car:
   change proportions, glass and lights until it reads as "a car like that", not that car.
2. Add a recipe to `scripts/carscan/recipes.mjs`: where the source's axles, sill, beltline and
   roof sit, which of its meshes are body, glass or trim, and the restyle settings.
3. `node scripts/carscan/bake.mjs <car id> <model.glb>` writes `src/scene/scans/<car id>.ts`.
4. Add the car to `SCANS` in `src/scene/scans/index.ts` with its window, light and door layout.
5. Check it: `npm run dev`, then `node scripts/carscan/shot/shoot.mjs out <car id>` (studio views,
   old and new) and `node scripts/carscan/ingame.mjs out <car id>` (garage and town, phone and
   desktop). `npx vitest run src/scene/scans` checks its size, wheels and draw cost.
6. Credit the source below.

## Credits

| Car | Source | Licence |
| --- | --- | --- |
| Sparkline Current (`current`) | "Car Concept" glTF sample, [KhronosGroup/glTF-Sample-Assets](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), itself from "Free Concept Car 004" by Unity Fan (CC0) | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); Khronos logos excluded and not used. Restyled: toy proportions, longer hood, narrower greenhouse, solid rear quarters, our own glass, lights and trim. |
