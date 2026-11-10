// A recipe without a photo: a small drawn bento box with its first letter
// (docs/VISION.md, "Bento touches"), on one of a few soft colours picked
// from its name, so the same recipe looks the same everywhere. Its colours
// are in styles/recipe-list.css (.stand-in), so the box can stay quieter than the letter.
export default function RecipeStandIn({ title, className }: { title: string; className: string }) {
  const letter = (Array.from(title.trim())[0] ?? "").toUpperCase();
  const shade = Array.from(title).reduce((sum, char) => sum + (char.codePointAt(0) ?? 0), 0) % 5;
  return (
    <span className={`${className} stand-in stand-in-${shade}`} aria-hidden="true">
      <svg viewBox="0 0 72 50">
        <rect className="bento-box" x="2" y="2" width="68" height="46" rx="5" />
        <path className="bento-lines" d="M44 3v44M44 25h25" />
        {/* The baran (the green divider leaf) down the middle, and an umeboshi. */}
        <path className="bento-baran" d="M44 6l3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3" />
        <circle className="bento-plum" cx="57" cy="14" r="5" />
        <text className="bento-letter" x="23" y="34" textAnchor="middle">
          {letter}
        </text>
      </svg>
    </span>
  );
}
