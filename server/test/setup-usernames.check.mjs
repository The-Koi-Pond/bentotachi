// First-time setup and usernames with stray dots, against a throwaway
// PocketBase on :8091 (set it up as pantry-rules.check.mjs says). Setup
// makes the admin email "<username>@bento.local", which can't start or end
// with a dot or have two together; before 2026-11-02 "sam." failed with a
// puzzling "email" error. The check comes before "already set up", so this
// works on a server that's set up too (it doesn't set anything up).
//   node test/setup-usernames.check.mjs
// Every line should say PASS.
const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

for (const username of ["sam.", ".sam", "j..r"]) {
  const res = await fetch(`${B}/cookbook/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, name: "Sam", password: "testpass123" }),
  });
  const data = await res.json();
  check(`setup refuses "${username}" and says why`, res.status === 400 && /dot/.test(data.message ?? ""), `(${res.status} ${data.message ?? ""})`);
}
