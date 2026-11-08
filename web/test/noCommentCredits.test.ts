// Run from the web folder with: node --test "test/*.test.ts"
// Code comments say why, not who asked or when: a credit like "(a name, a
// date)" belongs in docs/PLAN.md, where decisions and their dates are kept.
// This test finds such credits in comments (this file's examples aside).
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dirname, "..", "..");
const FOLDERS = ["web/src", "web/test", "web/scripts", "server/pb_hooks", "server/pb_migrations", "server/test"];
const SOURCE = /\.(ts|tsx|js|mjs|cjs|css)$/;
const DATE = "\\d{4}-\\d{2}-\\d{2}";
const CREDITS = [
  // A name or a few words, a comma, a date: "(Someone, 2026-11-08)",
  // "(meals.ts; Someone asked, 2026-11-08)".
  new RegExp(`[(;]\\s*[A-Za-z][\\w'.-]*(?:\\s+[\\w'.-]+){0,3},\\s*${DATE}(?=[\\s);:,.]|$)`),
  // The date first: "(snugger again 2026-11-07, Someone)".
  new RegExp(`\\([^()]{0,40}${DATE},\\s*[A-Za-z][\\w'.-]*\\)`),
  // A review, a tester or a housemate just before a date, however written.
  new RegExp(`\\b(?:review|re-check|tester|housemate|stress test)\\b[^."]{0,30}?,?\\s*\\(?${DATE}`, "i"),
];

function files(folder: string): string[] {
  return readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : files(path);
    return SOURCE.test(name) ? [path] : [];
  });
}

// The comments in a file, each with the line it starts on: /* blocks */,
// and runs of // lines joined, so a credit split across two lines counts.
function commentsOf(text: string): { text: string; line: number }[] {
  const comments: { text: string; line: number }[] = [];
  const lineAt = (index: number) => text.slice(0, index).split("\n").length;
  for (const block of text.matchAll(/\/\*[\s\S]*?\*\//g)) comments.push({ text: block[0], line: lineAt(block.index ?? 0) });
  const lines = text.split("\n");
  let run: string[] = [];
  let start = 0;
  const flush = () => {
    if (run.length) comments.push({ text: run.join("\n"), line: start });
    run = [];
  };
  lines.forEach((line, i) => {
    if (/^\s*\/\//.test(line)) {
      if (!run.length) start = i + 1;
      run.push(line.replace(/^\s*\/\/ ?/, ""));
      return;
    }
    flush();
    // A comment after code; "//" right after a ":" is a web address.
    const trailing = line.match(/(?:^|\s)(\/\/.*)$/);
    if (trailing) comments.push({ text: trailing[1], line: i + 1 });
  });
  flush();
  return comments;
}

// Each credit in a comment, as "file:line: the credit".
export function creditsIn(text: string, file: string): string[] {
  const found: string[] = [];
  for (const comment of commentsOf(text)) {
    for (const credit of CREDITS) {
      const match = comment.text.match(credit);
      if (!match || match.index === undefined) continue;
      const line = comment.line + comment.text.slice(0, match.index).split("\n").length - 1;
      found.push(`${file}:${line}: ${match[0].replace(/\s+/g, " ").trim()}`);
      break;
    }
  }
  return found;
}

test("comments don't credit who asked or when", () => {
  const found = FOLDERS.flatMap((folder) =>
    files(join(root, folder))
      .filter((path) => !path.endsWith("noCommentCredits.test.ts"))
      .flatMap((path) => creditsIn(readFileSync(path, "utf8"), relative(root, path).replaceAll("\\", "/")))
  );
  assert.deepEqual(
    found,
    [],
    "Code comments say why, not who asked or when: put the reason itself in the comment, and the decision with its date in docs/PLAN.md.\n" +
      found.join("\n")
  );
});

test("the check finds a credit in a comment, and leaves code and plain dates alone", () => {
  const count = (text: string) => creditsIn(text, "x.ts").length;
  assert.equal(count("const a = 1; // Bigger cards (Someone, 2026-11-08).\n"), 1);
  assert.equal(count("/* Snug (review re-check,\n   2026-11-08) */"), 1);
  assert.equal(count("// Starts at yesterday (Someone, 2026-11-08; it used to open on Monday).\n"), 1);
  assert.equal(count("// Sides go with the main (meals.ts; Someone, 2026-11-08).\n"), 1);
  // Split across two // lines.
  assert.equal(count("// a way in (Someone,\n// 2026-11-06: the old one hid it).\n"), 1);
  assert.equal(count("/* snug (snugger again 2026-11-07, Someone) */"), 1);
  assert.equal(count("// as it did to a housemate (2026-11-08).\n"), 1);
  // Not credits.
  assert.equal(count('const label = "(Mon, 2026-11-02)";\n// Mondays first.\n'), 0);
  assert.equal(count("// Checked on 2026-11-07 against PocketBase 0.40.6.\n"), 0);
  assert.equal(count('// The day it last asked, like "2026-11-08".\n'), 0);
  assert.equal(count('const url = "https://site.com/review/2026-11-08/cake";\n'), 0);
});
