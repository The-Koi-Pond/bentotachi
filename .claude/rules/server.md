---
paths:
  - "server/**"
---

# Writing server code (PocketBase)

- `pb_migrations/*.js`: database schema, applied in filename order on start.
  Base collections only get an `id` field automatically, so add `created` /
  `updated` autodate fields yourself.
- `pb_hooks/*.pb.js`: server routes and rules. Each handler runs in its own
  scope and can't see outer variables, so `require(`${__hooks}/file.js`)`
  inside it.
- `pb_hooks/recipe_parse.js`: not a hook (no `.pb.js`), a helper shared by
  the import route and the Node tests. Helpers like it are plain CommonJS
  (`module.exports`, `require`), since PocketBase's JS engine has no
  `import`. `?.` and `??` do work there (both checked on 0.40.6;
  household.pb.js uses `??`); older files avoid them only because an older
  note said so.
- `pb_hooks/pantry.pb.js`: server rules linking pantry and shopping list.
- Tests: `node --test "server/test/*.test.js"` from the project folder. The
  `*.check.mjs` files check the server end to end against a throwaway
  PocketBase on port 8091, or `BENTO_TEST_PORT` (instructions at the top of
  `pantry-rules.check.mjs`). `npm test`, `npm run release` and `npm run
  deploy` run them all on their own throwaway server (web/scripts/tests.mjs,
  port 8099, deleted afterwards); a new check file is picked up by itself,
  but must print a PASS line per check, FAIL on failure, and pick unique
  names (they share one server; pantry-rules runs first).
- A throwaway server: the already-downloaded `pocketbase.exe` with `--dir`
  in scratch space (not a folder named pb_data: a hook blocks it) and
  `--automigrate=false`. Without that flag, changing a collection's
  settings on a test server writes a migration file into `pb_migrations`
  that would change the real database (deploy, release, play and package
  refuse uncommitted files there, web/scripts/committed.mjs, but don't rely
  on it). Tell any reviewer agent the same.
- Every hook and migration also runs inside phones (phone-only mode), and a
  migration runs on the live Pi at the next deploy: try one that changes
  existing data on a copy of a backup first (`.claude/rules/pi.md`).
