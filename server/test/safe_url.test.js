// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { hostOf, isPublicUrl } = require("../pb_hooks/safe_url.js");

test("the host is found without login details or port", () => {
  assert.equal(hostOf("https://www.RecipeTinEats.com/x"), "www.recipetineats.com");
  assert.equal(hostOf("http://sam:pw@192.168.1.1:8080/admin"), "192.168.1.1");
  assert.equal(hostOf("http://evil.com@127.0.0.1/"), "127.0.0.1");
  assert.equal(hostOf("http://[::1]:8090/"), "[::1]");
  assert.equal(hostOf("ftp://x"), "");
});

test("public recipe sites are allowed", () => {
  for (const url of [
    "https://www.recipetineats.com/chicken-chasseur/",
    "https://www.taste.com.au/recipes/x",
    "http://8.8.8.8/x",
    "https://cdn.example.com/photo.jpg",
    "https://172.32.0.1/x",
    "https://100.128.0.1/x",
  ])
    assert.equal(isPublicUrl(url), true, url);
});

test("this computer and the home network are refused", () => {
  for (const url of [
    "http://localhost:8090/api/collections/users/records",
    "http://127.0.0.1:8090/_/",
    "http://192.168.1.1/",
    "http://10.0.0.5/",
    "http://172.16.4.2/",
    "http://169.254.169.254/latest/meta-data/",
    "http://100.64.12.34:8090/",
    "http://0.0.0.0/",
    "http://[::1]/",
    "http://[fe80::1]/",
    "http://router/",
    "http://printer.local/",
    "http://nas.lan/",
    "http://pi.tail1234.ts.net/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://localhost./",
    "https://sam@192.168.0.10/",
    "",
    "javascript:alert(1)",
  ])
    assert.equal(isPublicUrl(url), false, url);
});
