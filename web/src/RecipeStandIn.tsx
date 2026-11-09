// A recipe without a photo: a small drawn bento box with its first letter
// (docs/VISION.md, "Bento touches"), on one of a few soft colours picked
// from its name, so the same recipe looks the same everywhere.
export default function RecipeStandIn({ title, className }: { title: string; className: string }) {
  const letter = (Array.from(title.trim())[0] ?? "").toUpperCase();
  const shade = Array.from(title).reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0) % 5;
  return (
    <span className={`${className} stand-in stand-in-${shade}`} aria-hidden="true">
      <svg viewBox="0 0 72 50">
        <rect x="2" y="2" width="68" height="46" rx="5" fill="#fffdf6" stroke="#3a2f28" strokeWidth="2" />
        <path d="M44 3v44M44 25h25" stroke="#3a2f28" strokeWidth="1.6" />
        {/* The baran (the green divider leaf) down the middle, and an umeboshi. */}
        <path d="M44 6l3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3" fill="none" stroke="#5a9a8a" strokeWidth="1.6" />
        <circle cx="57" cy="14" r="5" fill="#a82d4a" />
        <text x="23" y="34" textAnchor="middle" fontFamily="'Pond Pebbles', system-ui, sans-serif" fontSize="22" fill="#3a2f28">
          {letter}
        </text>
      </svg>
    </span>
  );
}
