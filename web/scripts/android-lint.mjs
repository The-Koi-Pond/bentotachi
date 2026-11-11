// Android Lint on the app: `npm run lint:android`, and before every
// release and Play build (release.mjs, play.mjs). A new warning fails it;
// the accepted ones are in android/app/lint-baseline.xml (build.gradle's
// lint block says why). The report it prints a path to says what and where.

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { run } from "./buildTools.mjs";

const android = join(dirname(fileURLToPath(import.meta.url)), "..", "android");

export function lintAndroid() {
  run(`"${join(android, "gradlew.bat")}" :app:lintDebug --console=plain`, android);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) lintAndroid();
