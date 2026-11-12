import { useState } from "react";
import { recipePhotoUrl, type Recipe } from "./pb";
import RecipePhoto from "./RecipePhoto";
import { KeptImg, keptStep, useGaveUpPhotos } from "./KeptPhotos";

// The top of a recipe page: the cover, framed as set, then the gallery's
// photos (recipePhotos.ts), swiped through sideways with dots saying
// where you are. Tapping one opens it full size (onOpen: its file name, ""
// for the cover). A photo that won't come offline is left out, button,
// count and dot too.
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
  const [gone, reporter] = useGaveUpPhotos();
  const slides = [...(recipe.image ? [""] : []), ...gallery];
  const showing = slides.filter((name) => !gone.has(name));
  const photo = (name: string, lazy = false) =>
    name === "" ? (
      <RecipePhoto recipe={recipe} size="full" className="hero" fallback={null} onGaveUp={reporter(name)} />
    ) : (
      <KeptImg
        className="hero"
        src={recipePhotoUrl(recipe, name)}
        keptUrl={keptStep(recipe, name)}
        loading={lazy ? "lazy" : undefined}
        fallback={null}
        onGaveUp={reporter(name)}
      />
    );

  // One photo: as before, at its own shape.
  if (slides.length === 1) {
    const only = slides[0];
    return (
      // Clips a zoomed photo to its box; the heart hangs over the edge.
      <button className="hero-clip hero-button" onClick={() => onOpen(only)} aria-label="Open the photo full size" hidden={gone.has(only)}>
        {photo(only)}
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
            aria-label={`Photo ${showing.indexOf(name) + 1} of ${showing.length}, full size`}
            hidden={gone.has(name)}
          >
            {photo(name, i > 1)}
          </button>
        ))}
      </div>
      {showing.length > 1 && (
        <div className="hero-dots" aria-hidden="true">
          {showing.map((name, i) => (
            <span key={name || "cover"} className={i === shown ? "on" : ""} />
          ))}
        </div>
      )}
    </div>
  );
}
