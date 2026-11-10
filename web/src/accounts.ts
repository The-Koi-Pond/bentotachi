// The account rules every form shares (the first account on Login, a new
// member in Household, changes in Profile), matching the server's: a
// username's pattern is in the users_username migration, and 8 characters
// is PocketBase's shortest password.
export const MIN_PASSWORD = 8;

export const cleanUsername = (text: string) => text.toLowerCase().replace(/[^a-z0-9._-]/g, "");
