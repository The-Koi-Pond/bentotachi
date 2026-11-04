// Checks the fridge door's notes against a throwaway PocketBase on :8091 (set
// it up as pantry-rules.check.mjs says). Never point this at the real server:
// it creates test accounts and notes.
//   node test/notes.check.mjs
// Every line should say PASS.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
async function api(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`${method} ${path} -> ${res.status} ${text}`);
    error.status = res.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
const fails = async (call) => {
  try {
    await call();
    return 0;
  } catch (e) {
    return e.status;
  }
};

const admin = (await api("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).token;
const account = async (username) => {
  const user = await api(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: username });
  const { token } = await api("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" });
  return { id: user.id, token };
};
const run = Date.now();
const cy = await account(`cy${run}`);
const di = await account(`di${run}`);

const note = await api(cy.token, "POST", "/collections/notes/records", { text: `Don't buy eggs ${run}`, added_by: di.id });
check("a note is signed by whoever posted it", note.added_by === cy.id);
const seen = await api(di.token, "GET", `/collections/notes/records?filter=${encodeURIComponent(`text ~ "${run}"`)}`);
check("everyone in the household sees it", seen.items.some((n) => n.id === note.id));
const edited = await api(di.token, "PATCH", `/collections/notes/records/${note.id}`, { text: `Don't buy eggs or milk ${run}`, added_by: di.id });
check("editing keeps who posted it", edited.added_by === cy.id && edited.text.includes("milk"));
check("a note needs some text", (await fails(() => api(cy.token, "POST", "/collections/notes/records", { text: "" }))) === 400);
check("notes are short", (await fails(() => api(cy.token, "POST", "/collections/notes/records", { text: "x".repeat(501) }))) === 400);
const guest = await api("", "GET", "/collections/notes/records");
check("someone not logged in sees no notes", guest.items.length === 0);
check("...and can't post one", [400, 401, 403].includes(await fails(() => api("", "POST", "/collections/notes/records", { text: "hi" }))));
await api(di.token, "DELETE", `/collections/notes/records/${note.id}`);
check("anyone can take a note down", (await fails(() => api(cy.token, "GET", `/collections/notes/records/${note.id}`))) === 404);
