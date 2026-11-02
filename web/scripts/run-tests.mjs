// Runs everything release and deploy check first (tests.mjs), on its own,
// without building or sending anything:
//
//   npm test          (from the web folder)

import { runTests } from "./tests.mjs";

await runTests();
console.log("\nAll tests passed.");
