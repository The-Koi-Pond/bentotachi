// Whether a server address goes through Tailscale: one of its own addresses
// (100.64.0.0 to 100.127.255.255) or a MagicDNS name (ending .ts.net). Such a
// server can only be reached while Tailscale is on on this phone, so being
// offline says to check it.
export function viaTailscale(address: string): boolean {
  let host: string;
  try {
    host = new URL(/^[a-z]+:\/\//i.test(address) ? address : `http://${address}`).hostname.toLowerCase();
  } catch {
    // Not an address at all: nothing to point at.
    return false;
  }
  if (host.endsWith(".ts.net")) return true;
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d{1,3}$/.test(part))) return false;
  const [first, second] = parts.map(Number);
  return first === 100 && second >= 64 && second <= 127;
}
