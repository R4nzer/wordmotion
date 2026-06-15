import React from "react";
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import type { Caption } from "@remotion/captions";

interface SubtitlesProps {
  captions: Caption[];
}

const HIGHLIGHT_COLOR = "#f59e0b";

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
        <div style={{ fontSize: 44, fontWeight: 600, textAlign: "center",
          lineHeight: 1.5, fontFamily: '"Noto Serif SC", serif',
          textShadow: "0 3px 12px rgba(0,0,0,0.9)",
          maxWidth: 1700, padding: "0 60px", color: "#6b7280", opacity: 0.5 }}>
          {caption.text}
        </div>
      </AbsoluteFill>
    );
  }

  if (activeIndex === -1) return null;

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
          fontSize: 44,
          fontWeight: 600,
          textAlign: "center",
          lineHeight: 1.5,
          fontFamily: '"Noto Serif SC", serif',
          textShadow: "0 3px 12px rgba(0,0,0,0.9)",
          maxWidth: 1700,
          padding: "0 60px",
        }}
      >
        {chars.map((char, i) => (
          <span
            key={i}
            style={{
              color: i < highlightCount ? HIGHLIGHT_COLOR : "#e5e7eb",
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
