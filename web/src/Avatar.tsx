import { avatarUrl, displayName, personStyle, type User } from "./pb";

// Someone's profile picture, or (without one) the first letter of their name
// on a circle in their color. Decorative: their name is always shown nearby.
export default function Avatar({ user, size = 32 }: { user: User; size?: number }) {
  const url = avatarUrl(user);
  if (url) {
    return <img className="avatar" src={url} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  return (
    <span
      className="avatar avatar-initial"
      style={{ ...personStyle(user), width: size, height: size, fontSize: size * 0.45 }}
      aria-hidden="true"
    >
      {displayName(user).trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
