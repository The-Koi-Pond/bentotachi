// Marks in recipe text (see SoftText.tsx): words in *one pair* of asterisks
// show as soft grey italics ("2 eggs *or 3 if small*"), words in **two
// pairs** show bold ("**Don't** skip the resting"), and words in __double
// underscores__ are underlined. They combine: ***three pairs*** is soft and
// bold, and underscores can go around either (__**like this**__), which is
// what the B / I / U buttons write (see textFormat.ts). Only real pairs
// count: text right after the opening marks and right before the closing
// ones, on one line, so "2 * 3" and "5*" stay as they are.

const MARKS =
  /\*\*\*([^\s*](?:[^*\n]*[^\s*])?)\*\*\*|\*\*([^\s*](?:[^*\n]*[^\s*])?)\*\*|__([^\s_](?:[^_\n]*[^\s_])?)__|\*([^\s*](?:[^*\n]*[^\s*])?)\*/g;

export type Mark = "soft" | "bold" | "underline";

export interface TextPart {
  text: string;
  // None for plain text.
  marks: Mark[];
}

// What a match holds: the words inside, and the marks around them.
function marksOf(groups: (string | undefined)[]): [string, Mark[]] {
  const [triple, bold, underline, soft] = groups;
  if (triple !== undefined) return [triple, ["bold", "soft"]];
  if (bold !== undefined) return [bold, ["bold"]];
  if (underline !== undefined) return [underline, ["underline"]];
  return [soft ?? "", ["soft"]];
}

// The text in pieces, each with its marks. What's inside a pair is read
// again, so marks inside marks (__**like this**__) add up.
export function softParts(text: string, outer: Mark[] = []): TextPart[] {
  const parts: TextPart[] = [];
  let at = 0;
  for (const match of text.matchAll(MARKS)) {
    if (match.index > at) parts.push({ text: text.slice(at, match.index), marks: outer });
    const [inner, marks] = marksOf(match.slice(1));
    parts.push(...softParts(inner, [...outer, ...marks]));
    at = match.index + match[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), marks: outer });
  return parts;
}

// The words without their marks, for places that show plain text (like the
// shopping list).
export function withoutSoftMarks(text: string): string {
  return text.replace(MARKS, (_, ...groups: (string | undefined)[]) => withoutSoftMarks(marksOf(groups.slice(0, 4))[0]));
}
