// Fills a brand-new throwaway server with the made-up household in
// sandbox-data.mjs. Shared by the sandbox and the style check, so both show
// the same household. Never for a server with real data on it.
import { addDays, localToday, toStoredDate } from "../src/dates.ts";
import { MEMBERS, NOTES, PANTRY, PASSWORD, PLAN, RECIPES, SHOPPING } from "./sandbox-data.mjs";

// A calendar date `offset` days from today, as the server stores it.
export const sandboxDay = (offset) => toStoredDate(addDays(localToday(), offset));

// One request to the server at `api` (http://127.0.0.1:<port>/api).
export async function sandboxCall(api, token, method, path, body) {
  const answer = await fetch(api + path, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: token }) },
    body: body && JSON.stringify(body),
  });
  const text = await answer.text();
  if (!answer.ok) throw new Error(`${method} ${path}: ${answer.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

// The household as the app would make it: the first member through the
// first-account route, the second by the first, then the rest as them.
// Returns each member's login (by username) and each recipe's id (by title).
export async function fillSandbox(api) {
  const call = (token, method, path, body) => sandboxCall(api, token, method, path, body);
  const [first, ...others] = MEMBERS;
  await call("", "POST", "/cookbook/setup", { username: first.username, name: first.name, password: PASSWORD });
  const logins = {};
  const logIn = async (username) => {
    logins[username] = await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: PASSWORD });
  };
  await logIn(first.username);
  const token = logins[first.username].token;
  for (const member of others) {
    await call(token, "POST", "/collections/users/records", { ...member, password: PASSWORD, passwordConfirm: PASSWORD });
    await logIn(member.username);
  }

  await call(token, "POST", "/collections/household_settings/records", { country: "AU" });
  const recipeIds = {};
  for (const recipe of RECIPES) recipeIds[recipe.title] = (await call(token, "POST", "/collections/recipes/records", recipe)).id;
  for (const [name, location, subcategory, status, useBy] of PANTRY) {
    await call(token, "POST", "/collections/pantry_items/records", { name, location, subcategory, status, expires: useBy === null ? "" : sandboxDay(useBy) });
  }
  for (const [text, checked] of SHOPPING) await call(token, "POST", "/collections/shopping_items/records", { text, checked });
  for (const [offset, meal, title] of PLAN) {
    await call(token, "POST", "/collections/meal_plan/records", { date: sandboxDay(offset), meal, recipe: recipeIds[title], note: "" });
    // What was planned before today was cooked.
    if (offset < 0) await call(token, "POST", "/collections/cooked/records", { date: sandboxDay(offset), recipe: recipeIds[title] });
  }
  for (const [username, text] of NOTES) await call(logins[username].token, "POST", "/collections/notes/records", { text });
  return { logins, recipeIds };
}
