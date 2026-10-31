/// <reference path="../pb_data/types.d.ts" />

// Updates for the Android app, published by "npm run release" (in web/)
// into server/releases/: the APK plus latest.json describing it.
//
// GET /api/cookbook/app/latest    -> { versionCode, versionName, notes }
// GET /api/cookbook/app/download  -> the APK itself
//
// No login needed: the app has to be downloadable before anyone has
// installed it, and the server is only reachable at home or via Tailscale.

routerAdd("GET", "/api/cookbook/app/latest", (e) => {
  const releases = `${__hooks}/../releases`;
  let info;
  try {
    info = JSON.parse(toString($os.readFile(`${releases}/latest.json`)));
  } catch (err) {
    throw new NotFoundError("No app version has been published yet.");
  }
  return e.json(200, {
    versionCode: info.versionCode,
    versionName: info.versionName,
    notes: info.notes || "",
  });
});

routerAdd("GET", "/api/cookbook/app/download", (e) => {
  const releases = `${__hooks}/../releases`;
  let info;
  let apk;
  try {
    info = JSON.parse(toString($os.readFile(`${releases}/latest.json`)));
    // Only a plain file name inside the releases folder, nothing else.
    if (!/^[\w.-]+\.apk$/.test(info.file)) throw new Error("bad file name");
    apk = $os.readFile(`${releases}/${info.file}`);
  } catch (err) {
    throw new NotFoundError("No app version has been published yet.");
  }
  e.response.header().set("Content-Disposition", `attachment; filename="bento-${info.versionName}.apk"`);
  return e.blob(200, "application/vnd.android.package-archive", apk);
});
