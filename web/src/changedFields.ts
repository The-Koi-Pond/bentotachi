// Saving an edit sends only what this person changed, so a change saved
// meanwhile from another phone (new notes, a tag) isn't put back to how it
// was when the form opened. `after` and `before` are the same form turned
// into fields to save, now and as it opened.
export function changedFields(
  after: Record<string, unknown>,
  before: Record<string, unknown>
): Record<string, unknown> {
  const changed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(after)) {
    if (JSON.stringify(value) !== JSON.stringify(before[key])) changed[key] = value;
  }
  return changed;
}
