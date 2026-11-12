// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const styles = join(import.meta.dirname, "..", "src", "styles");

// Where a stylesheet asks for dark mode inside another block (an @media or
// @supports around it): theme.ts turns only top-level dark blocks on and
// off for the app's own Light / Dark choice, so a nested one would follow
// the phone instead, and the style check can't see that.
function nestedDarkBlocks(css: string): number[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const lines: number[] = [];
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "{") depth++;
    else if (char === "}") depth--;
    else if (char === "@" && text.startsWith("@media", i)) {
      const prelude = text.slice(i, text.indexOf("{", i));
      if (depth > 0 && prelude.includes("prefers-color-scheme")) lines.push(text.slice(0, i).split("\n").length);
    }
  }
  return lines;
}

test("every dark-mode block is at the top level, where the app's Light / Dark choice reaches it", () => {
  const nested = readdirSync(styles)
    .filter((name) => name.endsWith(".css"))
    .flatMap((name) => nestedDarkBlocks(readFileSync(join(styles, name), "utf8")).map((line) => `${name}:${line}`));
  assert.deepEqual(nested, []);
});

test("the nested dark-block finder finds one, and passes a top-level one", () => {
  assert.deepEqual(nestedDarkBlocks("@media (prefers-color-scheme: dark) { a { color: red } }"), []);
  assert.deepEqual(nestedDarkBlocks("@supports (display: grid) {\n  @media (prefers-color-scheme: dark) { a { color: red } }\n}"), [2]);
  assert.deepEqual(nestedDarkBlocks("/* @media (prefers-color-scheme: dark) { */ b { color: blue }"), []);
});
