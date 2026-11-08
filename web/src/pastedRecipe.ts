// A whole recipe pasted as text (from a message, an email, a document or a
// social post's caption), sorted into the "Add by hand" form's boxes for
// checking before it's saved (Add recipe → "Paste a recipe"). Like
// Paprika 4's "Create from Clipboard".
//
// Headings like "Ingredients", "Method" and "Notes" say where each part
// starts; without them, the short lines that look like ingredients at the
// top are the ingredients and the rest the steps. "Serves 4" and "Prep:
// 10 min" lines fill in servings and times. List marks and step numbers go
// (the app numbers steps itself); lines that are only hashtags go.

import { toMinutes } from "./paprikaImport.ts";

export interface PastedRecipe {
  title: string;
  description: string;
  servings: string;
  prep_minutes: number;
  cook_minutes: number;
  total_minutes: number;
  ingredients: string[];
  steps: string[];
  notes: string;
}

// The same headings the server reads blog posts by (recipe_parse.js).
const INGREDIENTS = /^(ingredients?|what you(['’]ll| will)? need|you(['’]ll| will)? need|shopping list)\b[^.]{0,40}$/i;
const STEPS = /^(instructions?|directions?|method|preparation|steps|how to( make( it)?)?)\b[^.]{0,30}$/i;
const NOTES = /^((recipe |cook['’]?s )?notes?|tips?( and tricks)?)\b[^.]{0,30}$/i;
const SERVINGS = /^(serves|servings?|makes|yields?)\b\s*:?\s*(.+)$/i;
// Only labelled times ("Cook time 20 min", "Cook: 20 min"), so a step like
// "Cook the pasta for 10 minutes" stays a step (found in review). The
// time is the last group.
const TIMES: [RegExp, "prep_minutes" | "cook_minutes" | "total_minutes"][] = [
  [/^prep(aration)?(\s+time\b\s*:?|\s*:)\s*(.+)$/i, "prep_minutes"],
  [/^cook(ing)?(\s+time\b\s*:?|\s*:)\s*(.+)$/i, "cook_minutes"],
  [/^(total(\s+time\b\s*:?|\s*:)|ready in\b\s*:?)\s*(.+)$/i, "total_minutes"],
];

// Which part a heading line starts, and any text after it on the same
// line ("Method: Melt, mix, bake", "Note: freezes well"). Null if it isn't
// one.
function headingOf(line: string): { part: "ingredients" | "steps" | "notes"; rest: string; label: string } | null {
  const parts = [
    ["ingredients", INGREDIENTS],
    ["steps", STEPS],
    ["notes", NOTES],
  ] as const;
  const labelled = line.match(/^([^:]{1,40}):\s*(\S.*)$/);
  if (labelled) {
    const found = parts.find(([, pattern]) => pattern.test(labelled[1].trim()));
    if (found) return { part: found[0], rest: labelled[2].trim(), label: labelled[1].trim() };
  }
  const found = parts.find(([, pattern]) => pattern.test(line));
  return found ? { part: found[0], rest: "", label: line } : null;
}

// A labelled time's minutes: "1 hour, 15 minutes" (75), "1h30" (90), or a
// bare "20" after "Cook:". 0 for a sentence ("20 minutes, this is our
// go-to") or no time.
function labelledMinutes(value: string): number {
  if (!value || /[,.!]\s+\p{L}/u.test(value)) return 0;
  const compact = value.match(/^(\d{1,2})\s*h\s*(\d{1,2})\s*(m|min|mins)?$/i);
  if (compact) return Number(compact[1]) * 60 + Number(compact[2]);
  const total = value.split(/,|\band\b/i).reduce((sum, piece) => sum + toMinutes(piece.trim()), 0);
  return total || (/^\d{1,3}$/.test(value) ? Number(value) : 0);
}

// A list's mark ("-", "•", "*", WP Recipe Maker's "▢" boxes, a ticked box).
const LIST_MARK = /^([-•*·▢☐□✓✔]|☐|☑)\s*/u;
// A step's own number: "1.", "2)", "Step 3:", "STEP 4 -".
const STEP_NUMBER = /^((step\s*)?\d{1,2}\s*[.):-]\s+|step\s*\d{1,2}\s*$)/i;

// A heading inside a list: a short line ending in ":" with no amounts.
const asHeading = (line: string) => (/^[^\d]{1,60}:$/.test(line) ? `# ${line.slice(0, -1).trim()}` : line);

// An ingredient line is short and isn't a sentence of instructions (as
// recipe_parse.js's looksLikeIngredient).
function looksLikeIngredient(line: string): boolean {
  if (line.length > 150) return false;
  const words = line.split(/\s+/).length;
  return !(/[.!]$/.test(line) && words >= 6 && !/^[\d½¼¾⅓⅔⅛]/.test(line));
}

export function readPastedRecipe(text: string): PastedRecipe | null {
  const recipe: PastedRecipe = {
    title: "",
    description: "",
    servings: "",
    prep_minutes: 0,
    cook_minutes: 0,
    total_minutes: 0,
    ingredients: [],
    steps: [],
    notes: "",
  };
  const parts = { intro: [] as string[], ingredients: [] as string[], steps: [] as string[], notes: [] as string[] };
  let part: keyof typeof parts = "intro";
  const headed = { ingredients: false, steps: false };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^(#[\p{L}\p{N}_]+[\s,]*)+$/u.test(line)) continue;
    // Without a list mark, bold marks or a notes app's "## " heading mark.
    const plain = line
      .replace(LIST_MARK, "")
      .replace(/^#{1,6}\s+/, "")
      .replace(/\*\*/g, "")
      .trim();
    // Servings and times come before the recipe itself ("Serves 4", "Prep:
    // 10 min", or several on one line split by "|"): read there only, so
    // "Makes great leftovers" in the notes stays a note.
    if (part === "intro" && !headed.ingredients && !headed.steps) {
      const pieces = plain.split(/\s+[|•·]\s+/);
      let meta = 0;
      for (const piece of pieces) {
        // Servings say how many ("Makes a great dinner" doesn't).
        const servings = piece.match(SERVINGS)?.[2].match(/\d/) ? piece.match(SERVINGS) : null;
        const time = TIMES.find(([pattern]) => pattern.test(piece));
        const minutes = time ? labelledMinutes((piece.match(time[0])?.slice(-1)[0] ?? "").trim()) : 0;
        if (servings && !recipe.servings && piece.length <= 60) {
          recipe.servings = servings[2].trim();
          meta += 1;
        } else if (time && minutes && piece.length <= 60) {
          recipe[time[1]] = minutes;
          meta += 1;
        }
      }
      if (meta && meta === pieces.length) continue;
    }
    // A heading, even after an emoji ("🛒 Ingredients:").
    const bare = plain.replace(/^[^\p{L}\p{N}]+/u, "");
    const heading = headingOf(bare);
    // "Ingredients for the dough": the ingredients start (if they haven't),
    // with a group heading; "Ingredients for 4 people" says the servings.
    const group = bare.match(/^ingredients?\s+(for\s+.+?):?$/i);
    if (group) {
      part = "ingredients";
      headed.ingredients = true;
      const people = group[1].match(/^for\s+(\d+(\s*[-–]\s*\d+)?)\s*(people|persons?|servings?|serves)?$/i);
      if (people) recipe.servings ||= people[1];
      else parts.ingredients.push(`# ${group[1][0].toUpperCase()}${group[1].slice(1)}`);
      continue;
    }
    // "Note: use 70% if you can" or "Tip: …" among the ingredients or steps
    // is an aside: it goes to the notes and the list carries on (found in
    // review). "Notes", "Tips" or "Recipe notes", with or without text,
    // start the notes, which may run on over more lines.
    const aside = !!heading && /^(note|tip)$/i.test(heading.label);
    if (heading?.part === "notes" && heading.rest && aside && part !== "intro" && part !== "notes") {
      parts.notes.push(heading.rest);
      continue;
    }
    if (heading && (heading.part !== "notes" || part !== "intro" || heading.rest)) {
      part = heading.part;
      if (heading.part !== "notes") headed[heading.part] = true;
      if (heading.rest) parts[part].push(heading.rest);
      continue;
    }
    parts[part].push(plain);
  }

  let intro = parts.intro;
  let ingredients = parts.ingredients;
  let steps = parts.steps;
  if (!headed.ingredients && !headed.steps) {
    // No headings: a short first line is the name; then the run of lines
    // that look like ingredients; the rest are steps.
    if (intro.length && intro[0].length <= 100 && !/[.!?]$/.test(intro[0])) recipe.title = intro.shift() ?? "";
    let at = 0;
    while (at < intro.length && looksLikeIngredient(intro[at]) && (/^[\d½¼¾⅓⅔⅛]/.test(intro[at]) || intro[at].split(/\s+/).length <= 6)) at += 1;
    ingredients = intro.slice(0, at);
    steps = intro.slice(at);
    intro = [];
  } else if (headed.ingredients && !headed.steps) {
    // Ingredients without a Method heading: they end where sentences begin.
    const at = ingredients.findIndex((line) => !looksLikeIngredient(line));
    if (at >= 0) {
      steps = [...ingredients.slice(at), ...steps];
      ingredients = ingredients.slice(0, at);
    }
  }
  if (intro.length) {
    if (intro[0].length <= 120) recipe.title = intro.shift() ?? "";
    recipe.description = intro.join("\n");
  }
  recipe.ingredients = ingredients.map(asHeading);
  recipe.steps = steps.map((line) => asHeading(line.replace(STEP_NUMBER, "").trim())).filter(Boolean);
  recipe.notes = parts.notes.join("\n");
  return recipe.ingredients.length || recipe.steps.length ? recipe : null;
}
