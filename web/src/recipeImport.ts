import { pb } from "./pb";

// What importing a recipe page gives: the new recipe, or (when a recipe
// from that page is already here) that one, for "Open it" or "Add another
// copy" (AlreadyHere.tsx). The server checks the link (import.pb.js);
// `again` asks for another copy anyway.
export type ImportResult = { id: string } | { duplicate: { id: string; title: string } };

export interface ImportRequest {
  url: string;
  // The page itself, when the app's browser or a saved page has it.
  html?: string;
  again?: boolean;
}

export async function importRecipe(request: ImportRequest): Promise<ImportResult> {
  try {
    const { id } = await pb.send<{ id: string }>("/api/cookbook/import", { method: "POST", body: request });
    return { id };
  } catch (err) {
    const answer = err as { status?: number; response?: { id?: unknown; title?: unknown } };
    if (answer.status === 409 && typeof answer.response?.id === "string") {
      return { duplicate: { id: answer.response.id, title: String(answer.response.title ?? "") } };
    }
    throw err;
  }
}
