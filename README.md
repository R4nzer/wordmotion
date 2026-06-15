# Wordmotion

<p align="center">
  <strong>One prompt. Your article. A fully narrated video.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://www.remotion.dev/"><img src="https://img.shields.io/badge/powered_by-Remotion-0b84f3" alt="Powered by Remotion"></a>
  <a href="#install"><img src="https://img.shields.io/badge/install-npx_skills_add-6e45f5" alt="Install"></a>
</p>

---

You wrote an article. It did well. Now you want a video version, but the thought of spending a weekend in a video editor makes you want to close your laptop.

Wordmotion is a Claude Code skill that takes a `.md` file and turns it into a narrated [Remotion](https://www.remotion.dev/) video. Each sentence gets its own voiceover clip. Each idea gets its own slide, with charts, timelines, and comparison tables instead of bullet points on a white background. Subtitles follow along word by word at the bottom of the screen, and every slide has something quietly moving: a blinking cursor, a pulsing glow, a card drifting just enough to feel alive.

It won't win an Oscar. But it will get your article onto YouTube while you work on the next one.

<br>

<table>
<tr><td width="50%">

### Who it's for

You write. You want video versions without the editing grind.

- Blog and newsletter authors going multi-platform
- Video essayists tired of building slides by hand
- Anyone with a backlog of articles that deserve a second life

</td><td width="50%">

### What you get

- Per-sentence AI voiceover (edge-tts)
- Slides built from charts, timelines, and comparisons
- Subtitles that highlight each word as it's spoken
- Something moving on every slide, the whole time
- Layout that stays out of the subtitle zone by default

</td></tr>
</table>

---

## Pipeline

```
Your .md article
    → Split into sentences
    → Generate audio (edge-tts)
    → Plan shots
    → Design slides
    → Sync audio and subtitles
    → Render (Remotion)
```

---

## Install

```bash
npx skills add R4nzer/wordmotion
```

You also need [edge-tts](https://github.com/rany2/edge-tts) (`pip install edge-tts`), a [Remotion](https://www.remotion.dev/) project, and the `remotion-best-practices` skill.

---

## Usage

You pick the voice, speed, and aspect ratio. The skill asks when it needs to.

```bash
# YouTube landscape
Turn this blog post into a video. en-US-GuyNeural voice, 1.5x speed, 1920x1080.

# TikTok portrait
Make a vertical video from my-essay.md. zh-CN-YunyangNeural, normal speed, 1080x1920.
```

If you don't specify everything upfront, the skill will ask.

| You choose | How |
|-----------|-----|
| TTS voice | `edge-tts --list-voices`. Pick one that fits your language |
| Speed | `+50%` brisk, `+0%` natural. Your call |
| Aspect ratio | `1920×1080` for YouTube or Bilibili, `1080×1920` for TikTok or Shorts |

Claude handles the rest: splitting text, generating audio, measuring durations, grouping shots, building slides, syncing everything, and rendering the MP4.

---

## How it works

The visuals come from typography, charts, and diagrams. No 3D. No character animation. Think of it as a presentation deck where each slide had a small design budget, and the designer took it seriously.

The text on screen captures the key point of what's being said. The subtitles at the bottom carry every word in real time. They don't compete because the framework gives them separate real estate: the slide owns the top, the subtitles own a strip at the bottom, and the two never overlap.

Every slide has something that keeps moving. Even if it's just a blinking colon on a clock or a card drifting up a few pixels. Static screens lose people. Motion keeps attention.

Audio and subtitles share the same timeline. No overlapping transitions that shift timestamps around. Frame 500 means the same thing everywhere.

---

## What's in the repo

```
wordmotion/
├── SKILL.md                # The orchestration guide Claude reads
├── templates/              # Reusable Remotion slide components
│   ├── SlideFrame.tsx      # Slide wrapper (fade-in, particles, safe zone)
│   ├── Subtitles.tsx       # Word-by-word highlight system
│   ├── Card.tsx            # Animated card
│   ├── ProgressBar.tsx     # Animated progress bar
│   ├── ComparisonTable.tsx # Two-column checklist
│   ├── BarChart.tsx        # Horizontal bar chart
│   ├── ParticleBackground.tsx
│   └── EasingPresets.ts
└── scripts/
    └── generate-audio.mjs  # Batch edge-tts generation
```

---

MIT
