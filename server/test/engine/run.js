// Runs the server's unit tests inside PocketBase's own JavaScript engine,
// from the test-only route web/scripts/tests.mjs adds to a throwaway server:
// each copied test file registers its tests with node-test.js, then each runs.
// Returns [{ file, name, ok, skipped, ms, error }].

// Node's Buffer.byteLength, which a test uses: UTF-8 bytes of a string.
function utf8Length(text) {
  var bytes = 0;
  for (var i = 0; i < text.length; i++) {
    var code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

module.exports.run = function (files, registryPath) {
  // PocketBase has a Buffer of its own, without byteLength.
  if (!globalThis.Buffer) globalThis.Buffer = { byteLength: utf8Length };
  else if (typeof globalThis.Buffer.byteLength !== "function") globalThis.Buffer.byteLength = utf8Length;
  var registry = require(registryPath).collected;
  var results = [];
  for (var f = 0; f < files.length; f++) {
    var file = files[f].split("/").pop();
    registry.length = 0;
    try {
      require(files[f]);
    } catch (err) {
      results.push({ file: file, name: "(loading the file)", ok: false, error: String((err && err.message) || err) });
      continue;
    }
    var tests = registry.slice();
    for (var t = 0; t < tests.length; t++) {
      if (tests[t].skip) {
        results.push({ file: file, name: tests[t].name, ok: true, skipped: true });
        continue;
      }
      var started = Date.now();
      try {
        var answer = tests[t].fn();
        if (answer && typeof answer.then === "function") throw new Error("an async test can't run here");
        results.push({ file: file, name: tests[t].name, ok: true, ms: Date.now() - started });
      } catch (err) {
        results.push({ file: file, name: tests[t].name, ok: false, ms: Date.now() - started, error: String((err && err.message) || err) });
      }
    }
  }
  return results;
};
