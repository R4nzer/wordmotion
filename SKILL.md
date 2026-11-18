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

  Chinese triggers: 把文章做成视频、把这篇文章做成视频、给文章配音、加旁白、
  做成讲解视频、文章转视频、生成动态幻灯片视频。
---

# Wordmotion

Turn a blog post or essay (`.md`) into a Remotion video. This skill covers pipeline-specific decisions and hard-won lessons. For Remotion API details, consult the [official docs](https://www.remotion.dev/docs) or the demo sources in any installed card library (see Phase 4).

## Pipeline Phases (follow in order)

```
0. Video Type Detection → 1. Audio Generation → 2. Data Generation → 3. Infrastructure → 4. Slide Design → 5. Assembly → 6. Render → 7. Verify
```

---

## Phase 0: Video Type Detection

Before generating anything, classify the video by its source text and the user's intent. Record the type in `shots.json` (top-level `videoType` field). The type drives card-retrieval preferences in Phase 4 — it never excludes a card, it only re-weights the default search.

| Type | Signals | Typical content |
|------|---------|-----------------|
| `explainer` | opinion, argument, mechanism, concept | essays, science explainers (default) |
| `product` | product/tool/UI walkthrough, feature list | app or service videos |
| `narrative` | timeline, characters, story arc | history, biography |
| `tutorial` | steps, operations, how-to | procedural guides |
| `news` | events, hot topics, short updates | briefings |

Ask the user only when the signals genuinely split between two types. Otherwise detect and proceed.

---

## Phase 1: Audio Generation

### Tool
`edge-tts` CLI (Python). Ask the user which voice and playback speed they want. If they haven't decided, suggest they browse available voices with `edge-tts --list-voices` and pick one that matches the text's language and the tone they're going for.

### When edge-tts is blocked (fallback ladder)

edge-tts goes through a Microsoft WebSocket endpoint and does get blocked — observed `WSServerHandshakeError: 403, Invalid response status` on every request while `--list-voices` still worked fine. **Synthesize one sentence and check its duration before looping the batch**, otherwise a whole pass produces 0-byte files.

Fallback order:

1. **Local Kokoro TTS** (`hexgrad/Kokoro-82M`, ~320MB). For Chinese, `zm_yunxi` is a young male voice close to Edge's `Yunxi`. Two traps: when `huggingface.co` is unreachable, fetch `config.json` / `kokoro-v1_0.pth` / `voices/*.pt` from `https://hf-mirror.com/hexgrad/Kokoro-82M/resolve/main/<file>` and monkeypatch `hf_hub_download` in both `kokoro.model` and `kokoro.pipeline` to return the local path; and on `huggingface_hub` 2.x the default download path dies with `process() takes no keyword arguments`, so that patch is not optional.
2. **macOS `say`.** `Tingting` / `Meijia` produce usable Chinese. `Eddy` / `Reed` / `Rocko` accept `-v` and then emit a ~0.016s empty file — check the first clip's duration, never trust exit code 0.
3. Whatever the engine, **record** `engine` and `voice` in `manifest.json`, so a later partial re-run cannot silently mix two voices.

### Sentence splitting
Split source `.md` at sentence-ending punctuation (`.`, `!`, `?`, `。`, `！`, `？` — adapt to the text's language). Filter out empty strings and lone punctuation artifacts from quote splitting.

### Generate script
Write `scripts/generate-audio.mjs`. For each sentence, shell out to edge-tts with the user's chosen voice and rate:
```bash
edge-tts --voice "<voice>" --rate="<rate>" --text "sentence text" --write-media "public/audio/s_001.mp3"
```
Use the template in `scripts/generate-audio.mjs` — it accepts the source file path and voice/rate as arguments.

- Output: `public/audio/s_XXX.mp3` (zero-padded, sequential). Kokoro writes `.wav` — pick one extension and keep the manifest, the `staticFile()` call and `afinfo` consistent with it
- Generate `public/audio/manifest.json`: `[{ index, id, filename, text, charCount, engine, voice }]`

### Handle failures
- Empty-text sentences produce 0-byte files — delete them
- After cleanup, rename remaining files sequentially so filenames match manifest indices

---

## Phase 2: Data Generation

### Measure audio durations

Use `afinfo` on macOS (ships with the OS) and `ffprobe` on Linux. **Do not assume ffmpeg exists.** A stock macOS has no system ffmpeg, and the copy bundled in `node_modules/@remotion/compositor-*/` is a minimal build — it has `scale` / `atempo` / `crop`, but no `setpts`, no `fps`, no `volumedetect`, and on macOS it only runs with `DYLD_LIBRARY_PATH` pointing at its own directory. Use it for cutting and single-frame grabs; anything else needs a real build:

```bash
python3 -m venv /tmp/ffenv && /tmp/ffenv/bin/pip install imageio-ffmpeg
```

### Generate `src/data/captions.json`
Walk sentences in order, accumulating `currentMs += durationMs`:
```json
[{ "text": "...", "startMs": 0, "endMs": 1340, "sentenceIndex": 1, "audioFile": "s_001.mp3", "charCount": 7 }]
```
All `startMs`/`endMs` are **absolute** (relative to video start, not per-shot).

### Generate `src/data/shots.json`
Group sentences into **15-25 shots**. Each shot maps to one slide. Attributes: `id`, `title`, `sentences` (1-based), `durationFrames`, `captionIndices` (0-based), `audioFiles`. Also record `videoType` (from Phase 0) at the top level and, per shot, a one-line `semanticSignature` (content type / emotion / pace) — Phase 4 card retrieval uses both.

**Shot grouping principle:** sentences that share a theme → one slide. The slide summarizes the audio's key point — it does NOT repeat the transcript verbatim.

---

## Phase 3: Infrastructure

### Project setup
- Resolution and fps: ask the user. Common defaults are `1920×1080` at 30fps for landscape (YouTube/Bilibili) or `1080×1920` for vertical (TikTok/Shorts).
- `Root.tsx`: import shots.json, sum `durationFrames` for total, pass to Composition (no calculateMetadata needed)
- `tsconfig.json`: ensure `resolveJsonModule: true`
- Dependencies: `remotion` and `@remotion/cli` only. `Audio` and `staticFile` come from core, and the caption type can live in `src/types.ts` — `@remotion/media` and `@remotion/captions` are not required
- Font: a serif font matching the text's language. Prefer a system font so rendering never depends on the network — Chinese: `"Songti SC", "STSong", "Noto Serif SC", serif`

### Shared components (template code in this skill's `templates/`)
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
Each slide = a **dynamic presentation page** by default, not a cinematic scene. Typography, charts, tables and diagrams carry the content. This is the baseline — the video type may justify heavier treatment (e.g. a `product` video can borrow camera moves and 2.5D cards from an external card library), but information clarity always outranks spectacle.

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

### Baseline content patterns (fallback library)

Pick one per shot based on the message when no external card matches (see the card retrieval protocol below):

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

### External card retrieval protocol (card libraries)

The baseline table is the fallback, not the ceiling. If a card library is installed, search it before settling for a baseline pattern.

**Supported libraries**

| Library | Path detection (first hit wins) | Card root |
|---------|--------------------------------|-----------|
| video-shotcraft | `~/ai-skills/video-shotcraft/`, then `~/.agents/skills/video-shotcraft/`, then a path set in the project config | `references/shots/<category>/<card>.md` + `demos/<category>/<card>/…` |

A library is "present" when its card root exists. Never hard-fail when a library is missing — the pipeline runs on baseline patterns alone.

**Retrieval per shot**

For every shot in `shots.json`:

1. **Semantic signature.** Write one line: content type (statement / data / contrast / process / question / conclusion), emotional intent, and pace need. This is the search key.
2. **Category lookup.** Shotcraft's directories are the index: `typography`, `data`, `opening`, `outro`, `transition`, `effects`, `rhythm`, `camera`, `ui-entrance`, `interaction`. Map the signature to one or two categories.
3. **Default weights by video type.** These only re-order the search — override freely when a shot's semantics demand it:

| Category | explainer | product | narrative | tutorial | news |
|----------|-----------|---------|-----------|----------|------|
| typography | ● | ○ | ○ | ● | ● |
| data | ● | ● | ○ | ○ | ○ |
| opening | ● | ● | ● | ○ | ○ |
| outro | ● | ● | ● | ○ | ○ |
| transition | ○ | ○ | ● | ○ | ○ |
| effects | ○ | ○ | ● | ○ | ○ |
| rhythm | ○ | ● | ○ | ○ | ○ |
| camera | ○ | ● | ○ | ○ | ○ |
| ui-entrance | ○ | ● | ○ | ● | ○ |
| interaction | ○ | ● | ○ | ○ | ○ |

(● = preferred, ○ = allowed. Nothing is forbidden.)

4. **Read, don't guess.** When a card matches, read the recipe card `.md` in full and the exact demo source its "参考实现" points to. The demo holds the tuned truth — easing, timing, pitfalls. Re-writing from the card name alone throws away all of that tuning. Cards mark "已知坑/命门" parameters: never downgrade them.
5. **Adapt, don't copy verbatim.** Port the card through `templates/card-adaptation.md` before it enters the slide.
6. **Record usage.** Append every card used to `src/data/cards-used.json`: `{ shotId, library, category, card, demoSource, attributionNote }`. Keep the library's ATTRIBUTION notice intact. If that file ends up empty while a library *is* installed, state it explicitly in the final report — hand-rolling every slide is a legitimate choice, but it has to be a stated one, not a silent omission.
7. **No match → fallback.** If no card fits, use a baseline pattern. Never force a card that fights the audio.

**Card adaptation rules (summary — full checklist in `templates/card-adaptation.md`)**

- Re-skin to the wordmotion dark tokens; carry the card's motion grammar and tuned parameters, not its colors.
- Keep the 160px subtitle safety zone and the canvas-filling layout rules.
- Ensure at least one continuously animating element per slide; entrance-only cards get a sustained accent (pulse / float / shimmer).
- Map card durations onto absolute frames inside the shot's `<Sequence>`; never use `TransitionSeries`.
- Deterministic rendering: no `Date.now()` / `Math.random()`; seed all randomness.

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
Each shot plays its sentence audio files in order, offset by their relative start times within the shot. **Resolve the shot's own captions first.** Indexing the global `captions` array with the shot-local `i` is the most common source of drift, and it only shows up from the second shot onward — the first shot looks perfect:

```tsx
// Before rendering the sequence:
const shotCaptions = shot.captionIndices.map((index) => captions[index]);
const firstStart = shotCaptions[0]?.startMs ?? 0;

// Inside each shot's Sequence:
shot.audioFiles.map((file, index) => (
  <Sequence
    key={file}
    from={Math.round(((shotCaptions[index].startMs - firstStart) / 1000) * fps)}
  >
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
- **Scale the font down on long sentences.** CJK sentences run long, and 44px wraps to four rows inside a 1700px box, pushing the first row up into the slide. Use `>90` chars → 32px, `>60` chars → 38px, otherwise 44px. `templates/Subtitles.tsx` ships `subtitleFontSize(text)`

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
./node_modules/.bin/remotion render src/index.ts <CompositionId> out/output.mp4 --codec=h264 --crf=18
```

The entry file is required when there is no `remotion.config.ts` pointing at one, and `--codec=h264` avoids the default ProRes output. For a single-slide fix do not re-render 30k frames — `--frames=<start>-<end>` renders just that slice.

---

## Phase 7: Verify

"Render exited 0" is not evidence. Check, in order:

1. **Duration** matches `sum(durationFrames) / fps` to within a frame. On macOS without ffmpeg: `mdls -name kMDItemDurationSeconds -name kMDItemPixelWidth -name kMDItemPixelHeight out/output.mp4`; elsewhere `ffprobe`.
2. **Audio is actually present.** Run `volumedetect` with a full ffmpeg build (the Remotion one does not have it): a mean near `-90 dB` means the `Audio` sequences never fired. A working narration track lands around `-28 dB` mean, `-5 dB` peak.
3. **Look at frames, one per layout family.** Subtitle overflow, clipped bottom rows and empty slides are all invisible in the log. The Remotion-bundled ffmpeg can grab stills: `-ss <t> -i out/output.mp4 -frames:v 1 frame.png`.
4. **Sync spot check.** Grab the frame at a shot boundary and read the caption — it must match the sentence being spoken there. Drift is cumulative, so one bad offset early makes the entire tail wrong.

## Post-production

A global speed change (e.g. the user asks for 1.5×) does not need a re-render. Stretch the finished file — subtitles are burned in, so the whole timeline scales together and sync is preserved exactly:

```bash
ffmpeg -i out/output.mp4 \
  -filter_complex "[0:v]setpts=PTS/<rate>,fps=30[v];[0:a]atempo=<rate>[a]" \
  -map "[v]" -map "[a]" -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart out/output-<rate>x.mp4
```

`atempo` preserves pitch, so the voice speeds up without becoming a chipmunk. The frame drop from `fps=` is invisible on slides, which are static most of the time.

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
| Imported card feels dead or off-brand | Card copied verbatim with its light-theme skin | Re-skin via `templates/card-adaptation.md`; keep motion grammar only |
| Imported card breaks audio sync | Card uses overlapping transitions or its own clock | Absolute-frame `<Sequence>`; map card time onto `shot.durationFrames` |
| Audio drifts from shot 2 onward | Shot-local `audioFiles` index used against the global `captions` array | Resolve `shot.captionIndices` into `shotCaptions` first, offset against `shotCaptions[0]` |
| Whole TTS batch is silent / 0 bytes | edge-tts endpoint returns 403 | Test one sentence first; fall back to local Kokoro, then macOS `say` |
| Subtitle row overlaps slide content | Fixed 44px on a long CJK sentence | `subtitleFontSize()` — 32px past 90 chars, 38px past 60 |
| `setpts` / `fps` / `volumedetect` "No such filter" | Using the ffmpeg bundled with Remotion | Install a full build (`imageio-ffmpeg` in a venv) for anything beyond cutting |
