# UI rules

Every screen, panel and popup follows these. `src/uiCopy.test.ts` enforces the copy limits.

1. **Show, don't tell.** Game renders, car thumbs, icons and numbers beat sentences.
2. **One short line per card**, 12 words at most. No flavour paragraphs: blurbs in game data are tooltips only (`title=`), which `TapTips` shows on a tap.
3. **Lists are visual rows or strips:** car or avatar, name, one stat, a state icon. Five steps of a ladder are five car tiles, not a five-row table.
4. **Status is an icon or colour** (✔ done, number = next, 🔒 locked, 👑 boss), never a word like "Beaten".
5. **One primary action per screen.** If the bottom bar has the big button, rows don't repeat it.
6. **Prizes are shown, not described:** the item on the player's own car, its tier, its bonus.
7. **Mobile first.** Check 390px wide phone and desktop. No overlapping containers, no oversized pills.
8. **Real assets only.** Mockups and previews use in-game renders and screenshots, never hand-drawn sketches.

Safety and legal copy (seizure warning, deleting an account, payments) stays in full.
Help that truly needs words goes in a tooltip (`title=`) or the How-to-play page, not on the screen.

**Every badge explains itself on a tap** (`src/ui/TapTip.tsx`). Phones never show hover tooltips, so:
- An icon, chip or pill that means something gets a `title="Name: what it does"`. A plain badge shows it on a tap; a button shows it on a press and hold.
- A badge inside a button (a rival's skill on a race row) takes `data-tap-tip` so a tap explains instead of pressing. Skills use `<SkillIcon>`.
- Say the effect as a number and where it counts (`+10% power · gears 1–2 · drag races`), not a sentence. Say so when it does nothing in races.
- Pills that need more (a car's skill, the businesses it loves) open a rich bubble with `showTip()`.
