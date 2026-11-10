// node:test's `test(name, fn)` for running the server's unit tests inside
// PocketBase's own JavaScript engine (web/scripts/tests.mjs, "server tests in
// PocketBase"): it only collects them; run.js runs them. Only what the tests
// use: synchronous tests, and `{ skip }`.
var tests = [];

function test(name, options, fn) {
  if (typeof options === "function") {
    fn = options;
    options = {};
  }
  tests.push({ name: name, fn: fn, skip: !!(options && options.skip) });
}

test.test = test;
test.collected = tests;
module.exports = test;
