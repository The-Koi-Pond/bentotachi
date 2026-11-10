// node:assert/strict's checks the server's unit tests use, for running them
// inside PocketBase's own JavaScript engine (see node-test.js). Strict like
// Node's: equal is Object.is, and deepEqual compares types, keys (a key
// that's undefined counts) and values all the way down.

function show(value) {
  var text;
  try {
    text = value === undefined ? "undefined" : typeof value === "string" ? JSON.stringify(value) : JSON.stringify(value) || String(value);
  } catch (err) {
    text = String(value);
  }
  return text.length > 300 ? text.slice(0, 300) + "…" : text;
}

function failed(message, actual, expected, wording) {
  var said = (message ? message + ": " : "") + wording + "\n  actual:   " + show(actual);
  if (expected !== undefined || wording.indexOf("expected") >= 0) said += "\n  expected: " + show(expected);
  throw new Error(said);
}

function same(a, b) {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Object.getPrototypeOf(a) !== Object.getPrototypeOf(b)) return false;
  if (a instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp) return String(a) === String(b);
  if (a instanceof Map || a instanceof Set) return same(Array.from(a), Array.from(b));
  var keysA = Object.keys(a);
  var keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (var i = 0; i < keysA.length; i++) {
    if (!Object.prototype.hasOwnProperty.call(b, keysA[i])) return false;
    if (!same(a[keysA[i]], b[keysA[i]])) return false;
  }
  return true;
}

module.exports = {
  equal: function (actual, expected, message) {
    if (!Object.is(actual, expected)) failed(message, actual, expected, "expected these to be equal");
  },
  notEqual: function (actual, expected, message) {
    if (Object.is(actual, expected)) failed(message, actual, undefined, "expected something other than");
  },
  deepEqual: function (actual, expected, message) {
    if (!same(actual, expected)) failed(message, actual, expected, "expected these to be deeply equal");
  },
  ok: function (value, message) {
    if (!value) failed(message, value, undefined, "expected something truthy, got");
  },
  match: function (text, pattern, message) {
    if (typeof text !== "string" || !pattern.test(text)) failed(message, text, String(pattern), "expected a match for the pattern");
  },
};
