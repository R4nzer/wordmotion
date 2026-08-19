# Card Adaptation Checklist

Porting a card from an external library (e.g. video-shotcraft) into a wordmotion slide.
Work through every section in order. Do not skip the read step — the demo source is
the tuned truth; the recipe card is its map.

## 1. Read the card completely

- [ ] Read the recipe card `.md` in full (semantics, parameter table, timing).
- [ ] Follow its "参考实现" pointer to the exact demo `.tsx` and read that too.
- [ ] Note every "已知坑/命门" (known pitfall) annotation. These parameters are
      the card's quality floor: adapt, but never downgrade.
- [ ] If the demo imports shared fixtures/components from the library's
      `assets/lib/` or `demos/_fixtures/`, copy those files into the project
      (the library licenses copy-and-modify reuse; check its ATTRIBUTION notice).

## 2. Re-skin to wordmotion tokens

Carry the motion grammar and tuned parameters. Replace the skin.

| Concern | Shotcraft-like default | Wordmotion token |
|---------|------------------------|------------------|
| Background | light page / product surface | `#0a0a0f` |
| Text | ink / dark gray | `#e5e7eb` |
| Accent | product brand color | `#f59e0b` |
| Danger / negative | product error color | `#ef4444` |
| Fonts | product font family | serif font matching the text's language |

- [ ] No hardcoded light-theme colors survive the port.
- [ ] Gradients/glows re-derived from the accent token, not the original brand hue.

## 3. Wordmotion layout constraints

- [ ] Canvas fills: no `maxWidth` straitjacket on content containers; use `flex: 1`.
- [ ] Font floors: 22px body / 28px headings / 36px+ key messages.
- [ ] Bottom safety: content stays out of the 160px subtitle zone (SlideFrame
      handles it; never hardcode small `bottom:` values inside the card).
- [ ] Subtitle z-index (100) stays above everything the card draws.

## 4. Motion constraints

- [ ] At least one element animates continuously from start to finish of the shot.
      Entrance-only cards (most shotcraft cards are) get one sustained accent:
      pulse `Math.sin(frame * 0.08) * 0.5 + 0.5`, float `Math.sin(frame * 0.04 + i) * 6`,
      shimmer, or blink. The particle background alone does not count.
- [ ] Hold budget respected: key info settles and holds ≥ 1s; batch entrances
      leave 0.5s of stillness after the last element lands.
- [ ] One animation idea per slide. If the card already has a star move, don't
      pile extra flourishes on top.

## 5. Timeline mapping (audio sync is sacred)

- [ ] The card renders inside its shot's `<Sequence>` with absolute `from`/`durationInFrames`.
- [ ] Card-internal timings map onto `shot.durationFrames` — stretch the
      holds/rests, never the eased impacts. Fast cards get extra hold time on a
      long shot; slow cards get trimmed from their holds on a short shot.
- [ ] No `TransitionSeries`, no cross-shot overlap, no `Date.now()` /
      `Math.random()` — seed any randomness (e.g. `mulberry32` from an index).

## 6. Bookkeeping

- [ ] Append `{ shotId, library, category, card, demoSource, attributionNote }`
      to `src/data/cards-used.json`.
- [ ] Attribution kept: the library's ATTRIBUTION/LICENSE note for the card and
      any copied assets is recorded and preserved in the project.

## 7. Visual QA before assembly

- [ ] Render one still per imported card (`npx remotion still ...`) and check:
      contrast against `#0a0a0f`, subtitle zone untouched, nothing clipped.
- [ ] If the card needs `three` / `@react-three/fiber` / `@remotion/three` or
      `@remotion/motion-blur`, install those dependencies and note them in the
      project README — otherwise pick a lighter card. Prefer zero-new-dependency
      cards for a port.
