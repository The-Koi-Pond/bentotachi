import type { ImgHTMLAttributes } from "react";
import { recipeImageUrl, type Recipe } from "./pb";
import { framingOf, framingStyle, type Framing } from "./photoFraming";

// A recipe's photo, framed the way it was set in the photo framer. "card"
// is a 600-wide copy for cards and thumbnails (the whole photo, so any
// framing works; not the 600x400 one, which is already cut to the middle);
// "full" is the photo itself, for the recipe page. `framing` overrides the
// saved one (the Edit page shows a change before it's saved).
export default function RecipePhoto({
  recipe,
  size,
  framing,
  ...rest
}: { recipe: Recipe; size: "card" | "full"; framing?: Framing } & ImgHTMLAttributes<HTMLImageElement>) {
  return (
    <img
      src={recipeImageUrl(recipe, size === "card" ? "600x0" : undefined)}
      alt=""
      {...rest}
      style={{ ...framingStyle(framing ?? framingOf(recipe.image_framing)), ...rest.style }}
    />
  );
}
