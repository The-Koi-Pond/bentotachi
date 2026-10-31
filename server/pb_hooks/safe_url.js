// Whether the server may fetch an address for someone: only public websites,
// never this computer or the home network (a router's settings page, the
// Pi itself, other devices). Used by the recipe importer for the page and
// for the photo address the page gives, which anyone's website controls.
// Tested in server/test/safe_url.test.js.
//
// Only the address as written is checked: PocketBase's fetch has no way to
// see where a name points or to refuse redirects, so a public name that
// points (or redirects) to a home address isn't caught. What's fetched is
// only read as a recipe or saved as a photo, never shown back.

// The host part, lowercased, without login details or port:
// "https://sam@Example.com:8080/x" -> "example.com", "http://[::1]/" -> "[::1]".
function hostOf(url) {
  var match = String(url).match(/^https?:\/\/([^\/?#\\]*)/i);
  if (!match) return "";
  var authority = match[1];
  var at = authority.lastIndexOf("@");
  if (at >= 0) authority = authority.slice(at + 1);
  if (authority[0] === "[") return authority.slice(0, authority.indexOf("]") + 1).toLowerCase();
  return authority.replace(/:\d*$/, "").replace(/\.$/, "").toLowerCase();
}

// Names only a home network or this computer knows.
var PRIVATE_NAMES = /(^localhost$|\.localhost$|\.local$|\.lan$|\.home$|\.internal$|\.intranet$|\.home\.arpa$|\.ts\.net$)/;

// 10.x, 127.x, 192.168.x, 172.16-31.x, 169.254.x (link-local), 100.64-127.x
// (Tailscale and carrier networks), 0.x, and 224 and up (multicast, reserved).
function isPrivateIPv4(host) {
  var parts = host.split(".").map(Number);
  var a = parts[0];
  var b = parts[1];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}

function isPublicUrl(url) {
  var host = hostOf(url);
  if (!host) return false;
  // Any address written as numbers in brackets (IPv6), like [::1]: recipe
  // sites are never reached that way.
  if (host[0] === "[") return false;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return !isPrivateIPv4(host);
  // Other number-only spellings ("2130706433", "0x7f.1") and names with no
  // dot ("router") are local or tricks.
  if (/^[\d.]+$/.test(host) || /^0x/.test(host) || host.indexOf(".") < 0) return false;
  return !PRIVATE_NAMES.test(host);
}

module.exports = { hostOf: hostOf, isPublicUrl: isPublicUrl };
