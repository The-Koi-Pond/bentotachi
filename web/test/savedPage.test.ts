// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { savedPageLink, trimSavedPage } from "../src/savedPage.ts";

test("a saved page's link comes from Chrome's 'saved from' mark first", () => {
  const html = `<!DOCTYPE html>\n<!-- saved from url=(0034)https://example.com/soup?a=1&b=2 -->\n<html><head><link rel="canonical" href="https://example.com/other"></head></html>`;
  assert.equal(savedPageLink(html), "https://example.com/soup?a=1&b=2");
});

test("without the mark, the page's canonical link, then og:url", () => {
  assert.equal(savedPageLink(`<link href="https://example.com/a?x=1&amp;y=2" rel="canonical">`), "https://example.com/a?x=1&y=2");
  assert.equal(savedPageLink(`<meta content="https://example.com/b" property="og:url">`), "https://example.com/b");
  assert.equal(savedPageLink(`<link rel="canonical" href="/relative"><meta property="og:url" content="https://example.com/c">`), "https://example.com/c");
});

test("a page with no link of its own gives none", () => {
  assert.equal(savedPageLink("<html><body>Soup</body></html>"), "");
  assert.equal(savedPageLink(`<link rel="stylesheet" href="https://example.com/site.css">`), "");
});

test("trimming keeps the recipe data and drops styles, drawings and comments", () => {
  const html = `<style>body{}</style><svg><path d="M0"/></svg><!-- hi --><script type="application/ld+json">{"@type":"Recipe"}</script><p>Soup</p>`;
  assert.equal(trimSavedPage(html), `<script type="application/ld+json">{"@type":"Recipe"}</script><p>Soup</p>`);
});
