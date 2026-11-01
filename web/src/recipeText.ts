// A recipe as plain text, for sharing it with someone (a message, an email,
// a note): its name, how many it makes and how long it takes, the
// ingredients (at the size it's scaled to), the numbered method, and where
// it came from. No soft marks, ratings or our own notes.

import { continuesNumbering, extraTimes, formatMinutes, headingOf, totalMinutes } from "./format.ts";
import { withoutSoftMarks } from "./softMarks.ts";
import { scaleLine, servingsCount, servingsText } from "./scaling.ts";

interface Shareable {
  title: string;
  servings?: string;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  extra_times?: unknown;
  ingredients?: string[] | null;
  steps?: string[] | null;
  source_url?: string;
}

export function recipeAsText(recipe: Shareable, scale = 1): string {
  const out: string[] = [recipe.title.trim()];

  const facts: string[] = [];
  const servings = (recipe.servings ?? "").trim();
  if (servings) {
    const base = servingsCount(servings);
    facts.push(`Makes ${base && scale !== 1 ? servingsText(servings, base * scale) : servings}`);
  }
  const times: [string, number][] = [
    ["Prep", recipe.prep_minutes],
    ["Cook", recipe.cook_minutes],
    ...extraTimes(recipe).map((time): [string, number] => [time.label, time.minutes]),
    ["Total", totalMinutes(recipe)],
  ];
  for (const [label, minutes] of times) if (minutes) facts.push(`${label} ${formatMinutes(minutes)}`);
  if (facts.length) out.push(facts.join(" · "));

  const ingredients = recipe.ingredients ?? [];
  if (ingredients.length) {
    out.push("", "Ingredients");
    for (const line of ingredients) {
      const heading = headingOf(line);
      out.push(heading !== null ? `\n${withoutSoftMarks(heading)}:` : `- ${withoutSoftMarks(scaleLine(line, scale))}`);
    }
  }

  const steps = recipe.steps ?? [];
  if (steps.length) {
    out.push("", "Method");
    let number = 0;
    for (const line of steps) {
      const heading = headingOf(line);
      if (heading !== null) {
        if (!continuesNumbering(line)) number = 0;
        out.push(`\n${withoutSoftMarks(heading)}:`);
      } else {
        number += 1;
        out.push(`${number}. ${withoutSoftMarks(line)}`);
      }
    }
  }

  if (recipe.source_url?.trim()) out.push("", `From ${recipe.source_url.trim()}`);
  return out.join("\n");
}
