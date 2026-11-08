---
paths:
  - "web/src/**"
  - "web/scripts/**"
  - "server/pb_hooks/**"
  - "server/pb_migrations/**"
  - "mobile/**"
---

# Reuse Bentotachi's shared pieces

- Before writing a helper or component, check `docs/shared-systems.md` for
  one that does the job, and grep for it.
- If one fits, use it, or extend it and its tests. Don't write a second copy,
  even a small one.
- When you make a new shared piece, add a line to `docs/shared-systems.md`
  ("for this job, use X (file)") in the section it belongs to; the map is
  ordered riskiest first.
- A copy you notice but aren't asked to fix goes in `TODO.md` under
  "Cleanup (only when Xel asks)": where, what's duplicated, which copy wins.
