// What else goes when a recipe is deleted (the server deletes these with
// it), said plainly in the "Delete?" question: "Its 2 planned dinners and
// 3 ratings go too." Nothing for counts of 0.

export interface RecipeExtras {
  planned: number;
  cooked: number;
  ratings: number;
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// The whole question for deleting one recipe or several picked at once.
// `forWhom` is " for everyone", or "" when one person uses Bentotachi.
// Several are named too (up to five, then "and 3 more"), since some picked
// ones may be in a closed drawer or scrolled away.
export function deleteQuestion(titles: string[], extras: RecipeExtras | null, forWhom: string): string {
  const what = titles.length === 1 ? `“${titles[0]}”` : `these ${titles.length} recipes (${namedList(titles)})`;
  const also = extras ? alsoDeleted(extras, titles.length > 1) : "";
  return `Delete ${what}${forWhom}? ${also ? `${also} ` : ""}This can't be undone.`;
}

function namedList(titles: string[]): string {
  const shown = titles.length > 5 ? titles.slice(0, 4) : titles;
  const names = shown.map((title) => `“${title}”`);
  const last = titles.length > 5 ? `${titles.length - 4} more` : names.pop()!;
  return `${names.join(", ")} and ${last}`;
}

export function alsoDeleted({ planned, cooked, ratings }: RecipeExtras, several = false): string {
  const parts = [
    planned && counted(planned, "night on the dinner plan", "nights on the dinner plan"),
    cooked && counted(cooked, `day ${several ? "they were" : "it was"} cooked`, `days ${several ? "they were" : "it was"} cooked`),
    ratings && counted(ratings, "rating", "ratings"),
  ].filter(Boolean) as string[];
  if (!parts.length) return "";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `${several ? "Their" : "Its"} ${list} will be deleted too.`;
}
