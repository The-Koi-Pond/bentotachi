import type { ImgHTMLAttributes, ReactNode } from "react";
import { recipeImageUrl, type Recipe } from "./pb";
import { framingOf, framingStyle, type Framing } from "./photoFraming";
import { keptCover, useKeptPhoto } from "./KeptPhotos";

// A recipe's photo, framed the way it was set in the photo framer. "card"
// is a 600-wide copy for cards and thumbnails (the whole photo, so any
// framing works; not the 600x400 one, which is already cut to the middle);
// "full" is the photo itself, for the recipe page. `framing` overrides the
// saved one (the Edit page shows a change before it's saved). Offline, the
// copy kept on the phone (KeptPhotos.tsx), if photos are kept; `fallback`
// when no photo will come.
export default function RecipePhoto({
  recipe,
  size,
  framing,
  fallback,
  ...rest
}: { recipe: Recipe; size: "card" | "full"; framing?: Framing; fallback?: ReactNode } & ImgHTMLAttributes<HTMLImageElement>) {
  const photo = useKeptPhoto(recipeImageUrl(recipe, size === "card" ? "600x0" : undefined), keptCover(recipe));
  if (photo.gaveUp && fallback !== undefined) return <>{fallback}</>;
  return (
    <img
      src={photo.src}
      onError={photo.onError}
      alt=""
      {...rest}
      style={{ ...framingStyle(framing ?? framingOf(recipe.image_framing)), ...rest.style }}
    />
  );
}
