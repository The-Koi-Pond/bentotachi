// The recipe form's tag box is plain text ("quick, vegetarian, dinn"):
// these read and change it for the tag suggestions under it.
import { normaliseTag } from "./recipeCategories.ts";
import { mentions } from "./wordMatch.ts";

function parts(text: string): string[] {
  return text.split(",");
}

// What's being typed after the last comma (lowercase), or "".
export function typedTag(text: string): string {
  return normaliseTag(parts(text).at(-1) ?? "");
}

// The tags already in the box, counting the one being typed.
export function tagsIn(text: string): string[] {
  return [...new Set(parts(text).map(normaliseTag).filter(Boolean))];
}

// Adds a tag, ending with ", " so typing can carry on. With replaceTyped,
// it takes the place of the half-typed tag it was picked to finish.
export function withTag(text: string, tag: string, replaceTyped: boolean): string {
  const all = parts(text).map((part) => part.trim());
  if (replaceTyped) all.pop();
  const kept = all.filter(Boolean).filter((part) => normaliseTag(part) !== normaliseTag(tag));
  return [...kept, tag].join(", ") + ", ";
}

// Which of the tags other recipes use to suggest (given most-used first):
// the ones not in the box yet, narrowed to the half-typed tag. A last word
// that's already a whole known tag ("…, mushroom") counts as finished, so
// it doesn't narrow the list, and picking a suggestion adds after it
// (narrowing: false) instead of replacing it.
export function suggestTags(used: string[], text: string): { tags: string[]; narrowing: boolean } {
  const inBox = new Set(tagsIn(text));
  const available = used.filter((tag) => !inBox.has(tag));
  const typed = typedTag(text);
  const matching = typed && !used.includes(typed) ? available.filter((tag) => tag.includes(typed)) : [];
  return matching.length ? { tags: matching, narrowing: true } : { tags: available, narrowing: false };
}

// Known tags (given most-used first) that the recipe itself mentions: in
// its name, description or ingredient lines, as whole words, plurals
// allowed ("noodles" from "200 g egg noodle"), and not as part of another
// product ("rice vinegar" doesn't suggest rice). Hyphens count as spaces,
// so "one-pot" matches "One Pot Pasta". Leaves out tags already in the box,
// and suggests only the first of a singular and plural ("appetiser",
// "appetisers").
export function tagsFromContent(known: string[], content: string, text: string): string[] {
  const singular = (tag: string) => tag.replace(/e?s$/, "");
  const taken = new Set(tagsIn(text).map(singular));
  const lines = content
    .split("\n")
    .map((line) => line.replace(/-/g, " "))
    .filter((line) => line.trim());
  const found: string[] = [];
  for (const tag of known) {
    if (taken.has(singular(tag)) || !lines.some((line) => mentions(line, tag.replace(/-/g, " ")))) continue;
    found.push(tag);
    taken.add(singular(tag));
  }
  return found;
}

// Takes out every one of these tags (any capitals).
export function withoutTags(text: string, tags: string[]): string {
  const gone = new Set(tags.map(normaliseTag));
  return parts(text)
    .map((part) => part.trim())
    .filter((part) => part && !gone.has(normaliseTag(part)))
    .join(", ");
}
