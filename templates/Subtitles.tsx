import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";

/**
 * Local caption shape — intentionally not imported from `@remotion/captions`
 * so the project needs no extra dependency. `build-data` writes exactly these
 * fields into `src/data/captions.json`.
 */
export interface Caption {
  text: string;
  startMs: number;
  endMs: number;
  sentenceIndex?: number;
  audioFile?: string;
  charCount?: number;
}

interface SubtitlesProps {
  captions: Caption[];
}

const HIGHLIGHT_COLOR = "#f59e0b";
const IDLE_COLOR = "#e5e7eb";
const FADED_COLOR = "#6b7280";
const FONT_STACK = '"Songti SC", "STSong", "Noto Serif SC", serif';

/**
 * CJK sentences run long. At a fixed 44px a 100-character sentence wraps to
 * four rows inside a 1700px box and the first row collides with the slide
 * content above, so step the size down with length.
 */
export const subtitleFontSize = (text: string): number => {
  const length = [...text].length;
  if (length > 90) return 32;
  if (length > 60) return 38;
  return 44;
};

/**
 * Simple subtitle component for Chinese text.
 * Finds the current sentence by absolute time and displays it
 * with character-by-character highlighting as the sentence progresses.
 */
export const Subtitles: React.FC<SubtitlesProps> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const currentTimeMs = (frame / fps) * 1000;

  // Find the active caption
  const activeIndex = captions.findIndex(
    (c) => currentTimeMs >= c.startMs && currentTimeMs < c.endMs
  );

  // Also show captions that just ended (hold for a brief moment)
  if (activeIndex === -1) {
    const justEnded = captions.findIndex(
      (c) => currentTimeMs >= c.endMs && currentTimeMs < c.endMs + 300
    );
    if (justEnded === -1) return null;
    // Show the just-ended caption dimly
    const caption = captions[justEnded];
    return (
      <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center",
        paddingBottom: 72, pointerEvents: "none", zIndex: 100 }}>
        <div style={{ fontSize: subtitleFontSize(caption.text), fontWeight: 600,
          textAlign: "center", lineHeight: 1.5, fontFamily: FONT_STACK,
          textShadow: "0 3px 12px rgba(0,0,0,0.9)",
          maxWidth: 1700, padding: "0 60px", color: FADED_COLOR, opacity: 0.5 }}>
          {caption.text}
        </div>
      </AbsoluteFill>
    );
  }

  const caption = captions[activeIndex];
  const sentenceDuration = caption.endMs - caption.startMs;
  const progress = Math.min((currentTimeMs - caption.startMs) / sentenceDuration, 1);

  // Split text into characters for highlighting
  const chars = [...caption.text];

  // How many characters to highlight (based on progress through the sentence)
  const highlightCount = Math.floor(chars.length * progress);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 72,
        pointerEvents: "none",
        zIndex: 100,
      }}
    >
      <div
        style={{
          fontSize: subtitleFontSize(caption.text),
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.5,
          fontFamily: FONT_STACK,
          textShadow: "0 3px 12px rgba(0,0,0,0.9)",
          maxWidth: 1700,
          padding: "0 60px",
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            style={{
              color: i < highlightCount ? HIGHLIGHT_COLOR : IDLE_COLOR,
              transition: "none",
            }}
          >
            {char}
          </span>
        ))}
      </div>
    </AbsoluteFill>
  );
};
