// Splits notes into separate items for showing like the method: a line
// starting with a number ("1. Rice – …", "2) …", or "**1. Rice** – …"
// with the number inside the bold) or a dash or bullet ("- …", "• …")
// starts an item, and lines after it, until a blank line, belong to it.
// Anything else is a plain paragraph, and "# Heading" lines are headings,
// as in ingredients and the method.

import { headingOf } from "./format.ts";

export type NoteBlock =
  | { kind: "heading"; text: string }
  // number: what the writer numbered it, or null for a dash or bullet.
  | { kind: "item"; number: string | null; lines: string[] }
  | { kind: "text"; lines: string[] };

// Marks (like ** for bold) may come before the number; they're kept, so
// "**1. Rice** – …" becomes "**Rice** – …" numbered 1.
const NUMBERED = /^\s*((?:\*{1,3}|__)*)\s*(\d{1,2})[.)]\s+(\S.*)$/;
const BULLETED = /^\s*[-•–—*]\s+(\S.*)$/;

export function noteBlocks(text: string): NoteBlock[] {
  const blocks: NoteBlock[] = [];
  // The item or paragraph that following lines carry on, if any.
  let open: Extract<NoteBlock, { lines: string[] }> | null = null;
  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      open = null;
      continue;
    }
    const heading = headingOf(line);
    const numbered = NUMBERED.exec(line);
    const bulleted = numbered ? null : BULLETED.exec(line);
    if (heading !== null) {
      blocks.push({ kind: "heading", text: heading });
      open = null;
    } else if (numbered) {
      open = { kind: "item", number: numbered[2], lines: [numbered[1] + numbered[3]] };
      blocks.push(open);
    } else if (bulleted) {
      open = { kind: "item", number: null, lines: [bulleted[1]] };
      blocks.push(open);
    } else if (open) {
      open.lines.push(line.trim());
    } else {
      open = { kind: "text", lines: [line.trim()] };
      blocks.push(open);
    }
  }
  return blocks;
}
