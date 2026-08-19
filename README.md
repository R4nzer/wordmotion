# Wordmotion

<p align="center">
  <strong>One prompt turns your article into a narrated video.</strong>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License"></a>
  <a href="https://www.remotion.dev/"><img src="https://img.shields.io/badge/powered_by-Remotion-0b84f3" alt="Powered by Remotion"></a>
  <a href="#install"><img src="https://img.shields.io/badge/install-npx_skills_add-6e45f5" alt="Install"></a>
</p>

---

You wrote an article. It did well. Now you want a video version, but the thought of spending a weekend in a video editor makes you want to close your laptop.

Wordmotion is an agent skill that takes a `.md` file and turns it into a narrated [Remotion](https://www.remotion.dev/) video. Each sentence gets its own voiceover clip. Each idea gets its own slide, with charts, timelines, and comparison tables instead of bullet points on a white background. Subtitles follow along word by word at the bottom of the screen, and every slide has something quietly moving: a blinking cursor, a card drifting just enough to feel alive.

It won't win an Oscar, but it will get your article onto YouTube while you work on the next one.

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
- Something moving on every slide, from start to finish
- Layout that stays out of the subtitle zone by default
- Optional card-library support (borrow tuned motion cards from video-shotcraft)

</td></tr>
</table>

---

## Pipeline

```
Your .md article
    → Detect video type
    → Split into sentences
    → Generate audio (edge-tts)
    → Plan shots
    → Design slides (baseline patterns + card-library retrieval)
    → Sync audio and subtitles
    → Render (Remotion)
```

---

## Install

```bash
npx skills add R4nzer/wordmotion
```

You also need [edge-tts](https://github.com/rany2/edge-tts) (`pip install edge-tts`) and a [Remotion](https://www.remotion.dev/) project.

### Card libraries (optional)

Wordmotion ships with a baseline library of slide patterns and works fine with nothing else installed. For more ambitious motion, it can also pull tuned motion cards from an external library:

```bash
git clone https://github.com/Vincentwei1021/video-shotcraft.git ~/ai-skills/video-shotcraft
```

When the library is present, every shot is matched against its card index (typography, data, opening, outro, transitions, effects), weighted by the detected video type. Nothing is hard-coded per video style. Cards are ported through `templates/card-adaptation.md`, which keeps each card's motion grammar while re-skinning it to wordmotion's dark theme, subtitle safe zone, and audio-sync rules. Without a library, the baseline patterns take over and the pipeline keeps working.

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

The agent handles the rest: splitting text, generating audio, measuring durations, grouping shots, building slides, syncing everything, and rendering the MP4.

---

## How it works

The visuals come from typography, charts, and diagrams by default. Think of it as a presentation deck where each slide had a small design budget, and the designer took it seriously. With a card library installed, the deck can go further into cinematic typography and data reveals. The ground rules stay the same: the information comes first.

The text on screen captures the key point of what's being said. The subtitles at the bottom carry every word in real time. They don't compete because each has its own real estate. The slide owns the top, the subtitles own a strip at the bottom.

Every slide has something that keeps moving, even if it's just a blinking colon on a clock. Static screens lose people.

Audio and subtitles share the same timeline. There are no overlapping transitions to shift timestamps around. Frame 500 means the same thing everywhere.

---

## What's in the repo

```
wordmotion/
├── SKILL.md                # The orchestration guide the agent reads
├── templates/              # Reusable Remotion slide components
│   ├── SlideFrame.tsx      # Slide wrapper (fade-in, particles, safe zone)
│   ├── Subtitles.tsx       # Word-by-word highlight system
│   ├── Card.tsx            # Animated card
│   ├── ProgressBar.tsx     # Animated progress bar
│   ├── ComparisonTable.tsx # Two-column checklist
│   ├── BarChart.tsx        # Horizontal bar chart
│   ├── ParticleBackground.tsx
│   ├── EasingPresets.ts
│   └── card-adaptation.md  # Checklist for porting external motion cards
└── scripts/
    └── generate-audio.mjs  # Batch edge-tts generation
```

---

MIT
