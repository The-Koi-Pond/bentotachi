import assert from "node:assert/strict";
import { test } from "node:test";
import { viaTailscale } from "../src/tailscale.ts";

test("Tailscale's own addresses count, with or without http:// and a port", () => {
  assert.equal(viaTailscale("http://100.101.102.103:8090"), true);
  assert.equal(viaTailscale("100.64.0.1:8090"), true);
  assert.equal(viaTailscale("http://100.127.255.255"), true);
});

test("MagicDNS names count", () => {
  assert.equal(viaTailscale("http://kitchen-pi.tail1234.ts.net:8090"), true);
  assert.equal(viaTailscale("https://KITCHEN-PI.TAIL1234.TS.NET"), true);
});

test("other 100. addresses, home addresses and names don't", () => {
  assert.equal(viaTailscale("http://100.63.0.1:8090"), false);
  assert.equal(viaTailscale("http://100.128.0.1:8090"), false);
  assert.equal(viaTailscale("http://10.100.0.5:8090"), false, "the 100 has to come first");
  assert.equal(viaTailscale("http://192.168.1.20:8090"), false);
  assert.equal(viaTailscale("http://127.0.0.1:8090"), false);
  assert.equal(viaTailscale("https://recipes.example.com"), false);
  assert.equal(viaTailscale("http://nots.net"), false);
});

test("something that isn't an address doesn't", () => {
  assert.equal(viaTailscale(""), false);
  assert.equal(viaTailscale("/"), false);
  assert.equal(viaTailscale("http://"), false);
});
