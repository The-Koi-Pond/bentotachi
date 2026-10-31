// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { toggleMark } from "../src/textFormat.ts";
import { softParts } from "../src/softMarks.ts";
import type { Mark } from "../src/softMarks.ts";

// Presses a button with the words between [ and ] selected, and returns the
// text afterwards with the new selection shown the same way.
function press(marked: string, mark: Mark): string {
  const start = marked.indexOf("[");
  const end = marked.indexOf("]") - 1;
  const value = marked.replace("[", "").replace("]", "");
  const change = toggleMark(value, start, end, mark);
  if (!change) return marked;
  const result = value.slice(0, change.from) + change.text + value.slice(change.to);
  return result.slice(0, change.selectStart) + "[" + result.slice(change.selectStart, change.selectEnd) + "]" + result.slice(change.selectEnd);
}

test("marks the selected words, and unmarks them again", () => {
  assert.equal(press("Use [fresh] basil", "bold"), "Use **[fresh]** basil");
  assert.equal(press("Use **[fresh]** basil", "bold"), "Use [fresh] basil");
  assert.equal(press("Use [fresh] basil", "soft"), "Use *[fresh]* basil");
  assert.equal(press("Use [fresh] basil", "underline"), "Use __[fresh]__ basil");
  assert.equal(press("Use __[fresh]__ basil", "underline"), "Use [fresh] basil");
});

test("marks combine in either order and read back correctly", () => {
  assert.equal(press("**[hot]**", "soft"), "***[hot]***");
  assert.equal(press("*[hot]*", "bold"), "***[hot]***");
  assert.equal(press("***[hot]***", "bold"), "*[hot]*");
  assert.equal(press("***[hot]***", "underline"), "__***[hot]***__");
  assert.equal(press("__***[hot]***__", "soft"), "__**[hot]**__");
  assert.deepEqual(softParts("__***hot***__"), [{ text: "hot", marks: ["underline", "bold", "soft"] }]);
});

test("a selection that includes the marks, or a trailing space, works the same", () => {
  assert.equal(press("Use [**fresh**] basil", "bold"), "Use [fresh] basil");
  assert.equal(press("Use [fresh ]basil", "bold"), "Use **[fresh]** basil");
});

test("each selected line is marked on its own, keeping headings", () => {
  assert.equal(press("[# Sauce\n2 eggs]\n1 cup milk", "bold"), "# **[Sauce**\n**2 eggs]**\n1 cup milk");
  assert.deepEqual(
    softParts("# **Sauce**\n**2 eggs**").map((part) => part.marks),
    [[], ["bold"], [], ["bold"]],
  );
});

test("nothing selected gives an empty pair to type into; only spaces does nothing", () => {
  assert.equal(press("Use [] basil", "bold"), "Use **[]** basil");
  assert.equal(press("Use[ ]basil", "bold"), "Use[ ]basil");
});

test("unpaired marks nearby are left alone", () => {
  assert.equal(press("snake_[case]", "bold"), "snake_**[case]**");
});
