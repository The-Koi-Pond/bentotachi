// What the B / I / U buttons (and Ctrl+B / I / U) do to the selected words
// in a text box: put marks around them (see softMarks.ts), or take them off
// if they already have that one. Selected lines are each marked on their
// own, as marks don't run across lines, and a "# " heading keeps its #.
// Marks are always written in one order (underscores outside the
// asterisks), so any mix of them reads back correctly.

import type { Mark } from "./softMarks.ts";

// Replace the text from `from` to `to` with `text`, then select
// selectStart to selectEnd (the marked words, without their marks).
export interface TextChange {
  from: number;
  to: number;
  text: string;
  selectStart: number;
  selectEnd: number;
}

type Marks = Record<Mark, boolean>;

interface Span extends Marks {
  // Where the marks before the words start, the words themselves, and
  // where the marks after them end (all within one line).
  runStart: number;
  innerStart: number;
  innerEnd: number;
  runEnd: number;
}

const isMark = (char: string | undefined) => char === "*" || char === "_";
const isSpace = (char: string | undefined) => char !== undefined && /\s/.test(char);

// The selected words on one line (from a to b), and the marks around them.
function spanIn(line: string, a: number, b: number): Span | null {
  const heading = /^#{1,2}\s+/.exec(line);
  if (heading && a < heading[0].length) a = heading[0].length;
  // Double-clicking a word also picks up the space after it on Windows.
  while (a < b && (isSpace(line[a]) || isMark(line[a]))) a++;
  while (b > a && (isSpace(line[b - 1]) || isMark(line[b - 1]))) b--;
  if (a >= b) return null;
  let runStart = a;
  while (isMark(line[runStart - 1])) runStart--;
  let runEnd = b;
  while (isMark(line[runEnd])) runEnd++;
  const count = (run: string, char: string) => run.split(char).length - 1;
  const before = line.slice(runStart, a);
  const after = line.slice(b, runEnd);
  const stars = count(before, "*");
  const unders = count(before, "_");
  // Only marks that pair up are ours; anything else is left alone.
  if (stars !== count(after, "*") || unders !== count(after, "_") || stars > 3 || (unders !== 0 && unders !== 2)) {
    return { runStart: a, innerStart: a, innerEnd: b, runEnd: b, soft: false, bold: false, underline: false };
  }
  return { runStart, innerStart: a, innerEnd: b, runEnd, soft: stars % 2 === 1, bold: stars >= 2, underline: unders === 2 };
}

function rewrite(line: string, span: Span, marks: Marks) {
  const stars = "*".repeat((marks.bold ? 2 : 0) + (marks.soft ? 1 : 0));
  const underline = marks.underline ? "__" : "";
  const open = underline + stars;
  const inner = line.slice(span.innerStart, span.innerEnd);
  return {
    line: line.slice(0, span.runStart) + open + inner + stars + underline + line.slice(span.runEnd),
    innerStart: span.runStart + open.length,
    innerEnd: span.runStart + open.length + inner.length,
  };
}

const EMPTY: Record<Mark, string> = { soft: "**", bold: "****", underline: "____" };

// The change for pressing a mark's button with start to end selected, or
// null if there's nothing to mark (only spaces selected).
export function toggleMark(value: string, start: number, end: number, mark: Mark): TextChange | null {
  // Nothing selected: an empty pair to type into.
  if (start === end) {
    const half = EMPTY[mark].length / 2;
    return { from: start, to: end, text: EMPTY[mark], selectStart: start + half, selectEnd: start + half };
  }
  // A selection ending just after a line break doesn't include the next line.
  if (end > start && value[end - 1] === "\n") end--;
  const from = start === 0 ? 0 : value.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = value.indexOf("\n", end);
  const to = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(from, to).split("\n");

  let offset = from;
  const spans = lines.map((line) => {
    const a = Math.max(start, offset) - offset;
    const b = Math.min(end, offset + line.length) - offset;
    offset += line.length + 1;
    return a < b ? spanIn(line, a, b) : null;
  });
  const first = spans.find((span) => span !== null);
  if (!first) return null;
  // The first selected words decide: mark them all, or unmark them all.
  const on = !first[mark];

  let selectStart = -1;
  let selectEnd = -1;
  offset = from;
  const text = lines
    .map((line, i) => {
      const span = spans[i];
      let result = line;
      if (span) {
        const changed = rewrite(line, span, { ...span, [mark]: on });
        if (selectStart < 0) selectStart = offset + changed.innerStart;
        selectEnd = offset + changed.innerEnd;
        result = changed.line;
      }
      offset += result.length + 1;
      return result;
    })
    .join("\n");
  return { from, to, text, selectStart, selectEnd };
}
