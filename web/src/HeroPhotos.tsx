import { useState } from "react";
import { recipePhotoUrl, type Recipe } from "./pb";
import RecipePhoto from "./RecipePhoto";
import { KeptImg, keptStep } from "./KeptPhotos";

// The top of a recipe page: the cover, framed as set, then the gallery's
// photos (recipePhotos.ts), swiped through sideways with dots saying
// where you are. Tapping one opens it full size (onOpen: its file name, ""
// for the cover).
export default function HeroPhotos({
  recipe,
  gallery,
  onOpen,
}: {
  recipe: Recipe;
  gallery: string[];
  onOpen: (name: string) => void;
}) {
  const [shown, setShown] = useState(0);
  const slides = [...(recipe.image ? [""] : []), ...gallery];

  // One photo: as before, at its own shape.
  if (slides.length === 1) {
    const only = slides[0];
    return (
      // Clips a zoomed photo to its box; the heart hangs over the edge.
      <button className="hero-clip hero-button" onClick={() => onOpen(only)} aria-label="Open the photo full size">
        {only === "" ? (
          <RecipePhoto recipe={recipe} size="full" className="hero" fallback={null} />
        ) : (
          <KeptImg className="hero" src={recipePhotoUrl(recipe, only)} keptUrl={keptStep(recipe, only)} fallback={null} />
        )}
      </button>
    );
  }

  return (
    <div className="hero-gallery">
      <div
        className="hero-strip"
        onScroll={(event) => {
          const strip = event.currentTarget;
          setShown(Math.round(strip.scrollLeft / Math.max(1, strip.clientWidth)));
        }}
      >
        {slides.map((name, i) => (
          <button
            key={name || "cover"}
            className="hero-clip hero-slide"
            onClick={() => onOpen(name)}
            aria-label={`Photo ${i + 1} of ${slides.length}, full size`}
          >
            {name === "" ? (
              <RecipePhoto recipe={recipe} size="full" className="hero" fallback={null} />
            ) : (
              <KeptImg className="hero" src={recipePhotoUrl(recipe, name)} keptUrl={keptStep(recipe, name)} loading={i > 1 ? "lazy" : undefined} fallback={null} />
            )}
          </button>
        ))}
      </div>
      <div className="hero-dots" aria-hidden="true">
        {slides.map((name, i) => (
          <span key={name || "cover"} className={i === shown ? "on" : ""} />
        ))}
      </div>
    </div>
  );
}
