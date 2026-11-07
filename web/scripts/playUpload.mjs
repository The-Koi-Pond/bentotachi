// Uploads an app bundle to a Google Play testing track, as the upload robot
// (a Google Cloud service account invited in Play Console with "Release apps
// to testing tracks"; its key is android/play-publisher.json, never
// committed). Used by play.mjs ("npm run play -- upload internal").
//
// Through Google's Play Developer API: sign in as the robot, open an edit,
// upload the bundle, put it on the track (with release notes in the store
// listing's language), and commit. Google then reviews it as usual.
// Uses only Node's own fetch and crypto.

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications";
const UPLOAD = "https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications";

// A sign-in token for the robot, from its key (a signed request, as Google's
// own libraries do it).
async function tokenFor(key) {
  const now = Math.floor(Date.now() / 1000);
  const part = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${part({ alg: "RS256", typ: "JWT" })}.${part({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: key.token_uri,
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");
  const answer = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  const body = await answer.json();
  if (!answer.ok) throw new Error(`Google wouldn't sign the robot in: ${body.error_description || body.error || answer.status}`);
  return body.access_token;
}

// One call to the API; Google's own message when it says no.
async function call(token, method, url, body, contentType = "application/json") {
  const answer = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body !== undefined && { "content-type": contentType }) },
    body: body === undefined ? undefined : contentType === "application/json" ? JSON.stringify(body) : body,
  });
  const text = await answer.text();
  const data = text ? JSON.parse(text) : {};
  if (!answer.ok) throw new Error(data.error?.message || `error ${answer.status}`);
  return data;
}

// Whether the robot can reach the app, changing nothing: its tracks and
// what's on each (opens an edit, reads, and throws the edit away).
export async function checkAccess({ keyFile, packageName }) {
  const key = JSON.parse(readFileSync(keyFile, "utf8"));
  const token = await tokenFor(key);
  const app = `${API}/${packageName}`;
  const edit = await call(token, "POST", `${app}/edits`, {});
  try {
    const { tracks = [] } = await call(token, "GET", `${app}/edits/${edit.id}/tracks`);
    return tracks.map((t) => ({
      track: t.track,
      releases: (t.releases ?? []).map((r) => `${r.name ?? "?"} (${(r.versionCodes ?? []).join(",")}) ${r.status}`),
    }));
  } finally {
    await call(token, "DELETE", `${app}/edits/${edit.id}`).catch(() => {});
  }
}

export async function uploadBundle({ keyFile, packageName, bundleFile, track, notes }) {
  const key = JSON.parse(readFileSync(keyFile, "utf8"));
  const token = await tokenFor(key);
  const app = `${API}/${packageName}`;
  const edit = await call(token, "POST", `${app}/edits`, {});
  const editUrl = `${app}/edits/${edit.id}`;
  try {
    const { defaultLanguage } = await call(token, "GET", `${editUrl}/details`);
    console.log("Uploading the bundle to Google Play…");
    const uploaded = await call(
      token,
      "POST",
      `${UPLOAD}/${packageName}/edits/${edit.id}/bundles?uploadType=media`,
      readFileSync(bundleFile),
      "application/octet-stream"
    );
    // On each track asked for ("internal,alpha"): the bundle is uploaded
    // once, as Play refuses the same version number twice. The release
    // replaces what was on the track (a draft waiting there included).
    uploaded.drafts = [];
    for (const name of track.split(",").map((t) => t.trim()).filter(Boolean)) {
      const release = (status) => ({
        track: name,
        releases: [
          {
            versionCodes: [String(uploaded.versionCode)],
            status,
            ...(notes && { releaseNotes: [{ language: defaultLanguage || "en-US", text: notes.slice(0, 500) }] }),
          },
        ],
      });
      try {
        await call(token, "PUT", `${editUrl}/tracks/${name}`, release("completed"));
      } catch (err) {
        // A track that isn't live yet (or an app that isn't published) only
        // takes a draft: it then waits in Play Console for "Send for review".
        if (!/draft/i.test(err.message)) throw err;
        await call(token, "PUT", `${editUrl}/tracks/${name}`, release("draft"));
        uploaded.drafts.push(name);
      }
    }
    await call(token, "POST", `${editUrl}:commit`);
    return uploaded;
  } catch (err) {
    // Nothing half-done is left open in Play Console.
    await call(token, "DELETE", editUrl).catch(() => {});
    throw err;
  }
}
