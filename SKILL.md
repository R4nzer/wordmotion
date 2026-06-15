---
name: wordmotion
description: |
  Turn blog posts and articles into Remotion dynamic slides videos.
  Made for content creators who turn written content into video.

  TRIGGER when the user wants to: create a video from text, make a narrated essay,
  turn a blog post into video, add voiceover to an article, or build a Remotion
  video with slides and audio from written content.

  Also trigger for: video essay, text-to-video, "turn my article into a video",
  "make a slideshow from this post", blog-to-video pipeline.
---

# Wordmotion

Turn a blog post or essay (`.md`) into a Remotion video. This skill covers pipeline-specific decisions and hard-won lessons. For Remotion API basics, consult the project's `remotion-best-practices` skill.

## Pipeline Phases (follow in order)

```
1. Audio Generation → 2. Data Generation → 3. Infrastructure → 4. Slide Design → 5. Assembly → 6. Render
```

---

## Phase 1: Audio Generation

### Tool
`edge-tts` CLI (Python). Ask the user which voice and playback speed they want. If they haven't decided, suggest they browse available voices with `edge-tts --list-voices` and pick one that matches the text's language and the tone they're going for.

### Sentence splitting
Split source `.md` at sentence-ending punctuation (`.`, `!`, `?`, `。`, `！`, `？` — adapt to the text's language). Filter out empty strings and lone punctuation artifacts from quote splitting.

### Generate script
Write `scripts/generate-audio.mjs`. For each sentence, shell out to edge-tts with the user's chosen voice and rate:
```bash
edge-tts --voice "<voice>" --rate="<rate>" --text "sentence text" --write-media "public/audio/s_001.mp3"
```
Use the template in `scripts/generate-audio.mjs` — it accepts the source file path and voice/rate as arguments.

- Output: `public/audio/s_XXX.mp3` (zero-padded, sequential)
- Generate `public/audio/manifest.json`: `[{ index, id, filename, text, charCount }]`

### Handle failures
- Empty-text sentences produce 0-byte files — delete them
- After cleanup, rename remaining files sequentially so filenames match manifest indices

---

## Phase 2: Data Generation

### Measure audio durations
Use `afinfo` (macOS) or `ffprobe` (Linux) on each file.

### Generate `src/data/captions.json`
Walk sentences in order, accumulating `currentMs += durationMs`:
```json
[{ "text": "...", "startMs": 0, "endMs": 1340, "sentenceIndex": 1, "audioFile": "s_001.mp3", "charCount": 7 }]
```
All `startMs`/`endMs` are **absolute** (relative to video start, not per-shot).

### Generate `src/data/shots.json`
Group sentences into **15-25 shots**. Each shot maps to one slide. Attributes: `id`, `title`, `sentences` (1-based), `durationFrames`, `captionIndices` (0-based), `audioFiles`.

**Shot grouping principle:** sentences that share a theme → one slide. The slide summarizes the audio's key point — it does NOT repeat the transcript verbatim.

---

## Phase 3: Infrastructure

### Project setup
- Resolution and fps: ask the user. Common defaults are `1920×1080` at 30fps for landscape (YouTube/Bilibili) or `1080×1920` for vertical (TikTok/Shorts).
- `Root.tsx`: import shots.json, sum `durationFrames` for total, pass to Composition (no calculateMetadata needed)
- `tsconfig.json`: ensure `resolveJsonModule: true`
- Dependencies: `@remotion/media`, `@remotion/captions`
- Font: a serif font matching the text's language (Google Fonts)

### Shared components (template code in `assets/templates/`)
Copy these into `src/components/shared/`:

| File | Role |
|------|------|
| `SlideFrame.tsx` | Every slide's wrapper — fade-in, particle background, **160px bottom padding** (subtitle safety) |
| `ParticleBackground.tsx` | Floating dots, runs full slide duration |
| `Card.tsx` | Animated card with delayed fade-in |
| `ProgressBar.tsx` | Animated progress bar |
| `ComparisonTable.tsx` | Two-column ✓/✗ checklist |
| `BarChart.tsx` | Horizontal bar chart |
| `Subtitles.tsx` | Word-by-word highlighting subtitle system |
| `EasingPresets.ts` | Standard easing curves |

---

## Phase 4: Slide Design Rules

### Visual philosophy
Each slide = a **dynamic presentation page**, not a cinematic scene. Use typography, charts, tables, diagrams — NOT scene modeling or 3D.

### Layout rules (non-negotiable)
1. **Fill the canvas.** No `maxWidth` constraints on content containers. Minimum font: 22px body, 28px headings, 36px+ for key messages. Use `flex: 1` to stretch content vertically.
2. **Dark theme.** Background `#0a0a0f`, text `#e5e7eb`, accent `#f59e0b`, danger `#ef4444`.
3. **Bottom safety.** SlideFrame gives 160px bottom padding. Never use `position: absolute; bottom: <small_value>`. Subtitles occupy the bottom ~140px.
4. **Every slide MUST have at least one element that animates continuously from start to finish.** Not just entrance — sustained motion. The particle background counts, but also add one visible element animation:
   - Pulse: `Math.sin(frame * 0.08) * 0.5 + 0.5`
   - Float: `Math.sin(frame * 0.04 + i) * 6` (px)
   - Blink: `Math.floor(frame / 15) % 2 === 0`
   - Rotate: `Math.sin(frame * 0.05) * 3` (degrees)
   - Shimmer: `Math.sin(frame * 0.07) * 0.15 + 0.15`

### Slide content patterns (pick one per shot based on the message)

| What the audio says | Visual pattern to use |
|---------------------|----------------------|
| Opening punch line | Centered giant title + code/terminal block |
| Social media feed | Row of cards sliding in sequentially |
| Us-vs-them contrast | Two-column ComparisonTable |
| Hierarchy / structure | Large SVG pyramid with highlighted layer |
| Progress / stats | Card with ProgressBars + calendar grid |
| Filter bubble / echo chamber | Concentric CSS circles with rotating labels |
| Before → after shift | Left/right split screen with animated divider |
| Late night / insomnia | Large monospace clock with blinking colon |
| Step-by-step process | Row of icon cards with subtitles |
| System failure (cascade) | CSS grid of status lights (green→yellow→red→grey) |
| Existential question | Centered scaling text with pulse |
| Timeline / journey | Three-column cards with arrow connectors |
| Formula / mechanism | Thermometer bar + equation cards |
| Two information streams | Side-by-side lists with scanning filter overlay |
| Connection severed | Animated line + scissors + sparkle |
| Rope / resilience | Labeled rope ends + comparison before/after |
| Small moments | Icon cards with subtle floating |
| Decision point | Branching yes/no cards → conclusion |
| Final philosophy | Large quote card + SVG icon + particles |

---

## Phase 5: MainVideo Assembly (Critical)

### Audio-visual sync — DO NOT use TransitionSeries

TransitionSeries overlaps cause audio/subtitle timing drift. Use **plain `<Sequence>` with absolute frame positions**:

```tsx
// Calculate each shot's absolute global start frame (NO overlap)
const shotPositions = useMemo(() => {
  let frame = 0;
  return shots.map(s => { const start = frame; frame += s.durationFrames; return { ...s, start }; });
}, []);
```

### Audio per shot
Each shot plays its sentence audio files in order, offset by their relative start times within the shot:
```tsx
// Inside each shot's Sequence:
audioFiles.map((file, i) => (
  <Sequence from={Math.round((captions[i].startMs - captions[0].startMs) / 1000 * fps)}>
    <Audio src={staticFile(`audio/${file}`)} />
  </Sequence>
))
```

### Subtitles at root level
Render `<Subtitles captions={allCaptions} />` OUTSIDE all shot Sequences. The Subtitles component:
- Uses `useCurrentFrame()` at root level → gets absolute global frame
- Finds active caption by `currentTimeMs >= startMs && currentTimeMs < endMs`
- Splits text into characters, highlights `progress * length` characters in gold
- Font: 44px serif, bottom 72px, z-index 100

Full structure:
```tsx
<AbsoluteFill style={{ backgroundColor: "#0a0a0f" }}>
  {shotPositions.map(shot => (
    <Sequence key={shot.id} from={shot.startFrame} durationInFrames={shot.durationFrames}>
      <SlideComponent />
      <ShotAudio ... />
    </Sequence>
  ))}
  <Subtitles captions={allCaptions} />
</AbsoluteFill>
```

---

## Phase 6: Render

```bash
npx remotion render <CompositionId> out/output.mp4
```

---

## Common Pitfalls

| Symptom | Cause | Fix |
|---------|-------|-----|
| Audio drifts from subtitles over time | TransitionSeries overlap shifts start frames | Use plain `<Sequence>` with absolute `from` |
| Content overlaps subtitles | Bottom padding too small or hardcoded `bottom: N` | SlideFrame enforces 160px bottom; never hardcode small bottom values |
| Elements clustered in small area | `maxWidth: 400` etc. on wide canvas | Remove maxWidth, let flex fill space, min font 22px |
| Slide feels dead after entrance | No sustained animation | Add `Math.sin(frame * speed)` to at least one visible element per slide |
| Quotes produce bogus empty sentences | Quote-splitting leaves lone punctuation | Filter manifest entries where `text.trim()` is a single punctuation char |
| Duplicate sentences in audio | Files not renumbered after deleting bogus entries | Rename remaining files sequentially after cleanup |
