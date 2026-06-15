/**
 * Generate audio files from a source markdown file using edge-tts.
 *
 * Usage: node scripts/generate-audio.mjs <path-to-source.md> [voice] [rate]
 * Example: node scripts/generate-audio.mjs ../my-essay.md zh-CN-YunyangNeural +50%
 */

import { execSync } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");
const AUDIO_DIR = join(PROJECT_ROOT, "public", "audio");

// First CLI argument is the source file, or fall back to an env var
const SOURCE_FILE = resolve(
  process.argv[2] || process.env.SOURCE_FILE || join(PROJECT_ROOT, "..", "source.md")
);

if (!existsSync(SOURCE_FILE)) {
  console.error("Source file not found: " + SOURCE_FILE);
  console.error("Usage: node scripts/generate-audio.mjs <path-to-source.md>");
  process.exit(1);
}

console.log("Source: " + SOURCE_FILE);

const VOICE = process.argv[3] || process.env.TTS_VOICE || "zh-CN-YunyangNeural";
const RATE = process.argv[4] || process.env.TTS_RATE || "+50%";

// Ensure audio directory exists
if (!existsSync(AUDIO_DIR)) {
  mkdirSync(AUDIO_DIR, { recursive: true });
}

// Read source text
const rawText = readFileSync(SOURCE_FILE, "utf-8");

// Clean markdown: remove markdown formatting but keep the text structure
// We want the raw text lines, removing empty paragraph separators
const lines = rawText
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("```"));

const fullText = lines.join("");

/**
 * Split Chinese text into sentences.
 * Splits on: 。！？ followed by non-quote content
 * Also handles English periods when followed by Chinese text or space+Chinese
 */
function splitSentences(text) {
  const sentences = [];
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    current += char;

    // Check if this character ends a sentence
    const isChineseEnd = ["。", "！", "？"].includes(char);
    const isQuoteEnd =
      char === '"' &&
      (i + 1 >= text.length || ["，", "。", "！", "？", "\n"].includes(text[i + 1]) || text[i + 1] === " ");

    // A sentence ends on Chinese punctuation or on a closing quote that follows Chinese punctuation
    if (isChineseEnd || isQuoteEnd) {
      // Also include trailing quotes
      if (i + 1 < text.length && text[i + 1] === '"') {
        current += text[i + 1];
        i++;
      }
      if (current.trim().length > 0) {
        sentences.push(current.trim());
      }
      current = "";
    }
  }

  // Push remaining text if any
  if (current.trim().length > 0) {
    sentences.push(current.trim());
  }

  return sentences;
}

const sentences = splitSentences(fullText);

console.log(`Found ${sentences.length} sentences.`);
console.log("First 5 sentences:");
sentences.slice(0, 5).forEach((s, i) => console.log(`  ${i + 1}. ${s.substring(0, 80)}...`));

// Generate audio for each sentence
const manifest = [];
const total = sentences.length;

for (let i = 0; i < total; i++) {
  const sentence = sentences[i];
  const index = String(i + 1).padStart(3, "0");
  const filename = `s_${index}.mp3`;
  const filepath = join(AUDIO_DIR, filename);

  // Escape special characters for shell
  const escapedText = sentence.replace(/"/g, '\\"').replace(/`/g, "\\`").replace(/\$/g, "\\$");

  console.log(`[${i + 1}/${total}] Generating ${filename}...`);
  console.log(`  Text: ${sentence.substring(0, 60)}${sentence.length > 60 ? "..." : ""}`);

  try {
    const cmd = `edge-tts --voice "${VOICE}" --rate="${RATE}" --text "${escapedText}" --write-media "${filepath}"`;
    execSync(cmd, { stdio: "pipe", timeout: 30000 });
    console.log(`  ✓ Done`);
  } catch (err) {
    console.error(`  ✗ Failed: ${err.message}`);
    // Continue with next sentence even if one fails
  }

  manifest.push({
    index: i + 1,
    id: `s_${index}`,
    filename: filename,
    text: sentence,
    charCount: sentence.length,
  });
}

// Write manifest
const manifestPath = join(AUDIO_DIR, "manifest.json");
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
console.log(`\nManifest written to ${manifestPath}`);
console.log(`Total: ${manifest.length} sentences processed.`);
