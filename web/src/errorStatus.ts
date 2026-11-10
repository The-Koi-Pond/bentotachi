// The HTTP status a failed server call came back with: 0 when it never
// reached the server (offline, or loginGuard.ts's stand-in page), -1 for
// anything else that went wrong. No pb.ts import, so tested modules can use it.
export function statusOf(err: unknown): number {
  const status = (err as { status?: unknown } | null)?.status;
  return typeof status === "number" ? status : -1;
}
