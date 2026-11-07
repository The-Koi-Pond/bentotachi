// Finding an ingredient's name in a line of text, the way Bento does it
// everywhere (pantry links, tag suggestions, regional names): as whole
// words, allowing plurals ("Onion" matches "2 onions, diced"), and not as
// part of a different product ("rice vinegar" isn't Rice, "coconut milk"
// isn't Milk; see the word lists below). Accents and hyphens don't count:
// "Jalapeno" matches "jalapeños", "Self raising flour" "self-raising flour".

// The text in lower case, without accents, and with hyphens as spaces, one
// character for each character so positions in it are positions in the
// text: "Crème-fraîche" -> "creme fraiche".
export function foldText(text: string): string {
  let folded = "";
  for (const char of text) {
    if (char === "-") {
      folded += " ";
      continue;
    }
    const lower = char.toLowerCase();
    const plain = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
    // Kept as it is when a change would alter the length ("İ" lowercases
    // to two characters).
    folded += plain.length === char.length ? plain : lower.length === char.length ? lower : char;
  }
  return folded;
}

// "Tomatoes" -> "tomato", "Eggs" -> "egg", "Rice" -> "rice".
export function stem(name: string): string {
  const n = name.trim().toLowerCase();
  if (n.length > 4 && /(ch|sh|x|ss|o)es$/.test(n)) return n.slice(0, -2);
  if (n.length > 3 && n.endsWith("s") && !n.endsWith("ss")) return n.slice(0, -1);
  return n;
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Words that make a different product when they come straight after a
// name: "rice vinegar", "garlic powder", "chicken stock", "tomato paste".
const PRODUCT_AFTER = new Set([
  "vinegar", "wine", "flour", "noodle", "paper", "paste", "powder", "milk", "oil", "sauce", "stock",
  "broth", "bouillon", "cube", "cheese", "cream", "flake", "salt", "syrup", "water", "butter",
  "seasoning", "cracker", "cake", "chip",
]);

// Words that make a different product when they come straight before a
// name: "coconut milk", "peanut butter", "sour cream", "almond flour".
const PRODUCT_BEFORE = new Set(["coconut", "almond", "oat", "soy", "peanut", "rice", "sour", "ice", "cream", "corn"]);

// "noodles" -> "noodle", for checking the word lists.
const singular = (word: string) => (word.length > 3 && word.endsWith("s") && !word.endsWith("ss") ? word.slice(0, -1) : word);

// Where the name first appears in the line (as above), or null. The
// positions are in the line as given.
export function findMention(line: string, name: string): { start: number; end: number } | null {
  const text = foldText(line);
  const stemmed = stem(foldText(name));
  if (!stemmed) return null;
  // Whole words only: "egg" mustn't match "eggplant", "salt" not "unsalted".
  // Any spacing between a name's words ("self  raising", "self-raising").
  const words = escapeForRegex(stemmed).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(`(^|[^a-z])(${words}(?:e?s)?)(?=$|[^a-z])`, "g");
  for (const match of text.matchAll(pattern)) {
    const start = match.index + match[1].length;
    const end = start + match[2].length;
    const after = text.slice(end).match(/^[\s-]+([a-z]+)/)?.[1] ?? "";
    const before = text.slice(0, start).match(/([a-z]+)[\s-]+$/)?.[1] ?? "";
    if (!PRODUCT_AFTER.has(singular(after)) && !PRODUCT_BEFORE.has(before)) return { start, end };
  }
  return null;
}

// Whether the name appears in the line (as above).
export function mentions(line: string, name: string): boolean {
  return findMention(line, name) !== null;
}
