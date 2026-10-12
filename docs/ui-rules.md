# UI rules

Every screen, panel and popup follows these. `src/uiCopy.test.ts` enforces the copy limits.

1. **Show, don't tell.** Game renders, car thumbs, icons and numbers beat sentences.
2. **One short line per card**, 12 words at most. No flavour paragraphs: blurbs in game data are tooltips only (`title=`).
3. **Lists are visual rows or strips:** car or avatar, name, one stat, a state icon. Five steps of a ladder are five car tiles, not a five-row table.
4. **Status is an icon or colour** (✔ done, number = next, 🔒 locked, 👑 boss), never a word like "Beaten".
5. **One primary action per screen.** If the bottom bar has the big button, rows don't repeat it.
6. **Prizes are shown, not described:** the item on the player's own car, its tier, its bonus.
7. **Mobile first.** Check 390px wide phone and desktop. No overlapping containers, no oversized pills.
8. **Real assets only.** Mockups and previews use in-game renders and screenshots, never hand-drawn sketches.

Help that truly needs words goes in a tooltip (`title=`) or the How-to-play page, not on the screen.
