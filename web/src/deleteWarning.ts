// What else goes when a recipe is deleted (the server deletes these with
// it), said plainly in the "Delete?" question: "Its 2 planned dinners and
// 3 ratings go too." Nothing for counts of 0.

export interface RecipeExtras {
  planned: number;
  cooked: number;
  ratings: number;
}

const counted = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function alsoDeleted({ planned, cooked, ratings }: RecipeExtras): string {
  const parts = [
    planned && counted(planned, "night on the dinner plan", "nights on the dinner plan"),
    cooked && counted(cooked, "“We cooked this” day", "“We cooked this” days"),
    ratings && counted(ratings, "rating", "ratings"),
  ].filter(Boolean) as string[];
  if (!parts.length) return "";
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  return `Its ${list} will be deleted too.`;
}
