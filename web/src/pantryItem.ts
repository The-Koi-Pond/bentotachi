// Where a pantry item shows, and its brands (see the pantry_opened_notes
// migration).

interface Placed {
  location: string;
  subcategory: string;
  opened_location?: string;
  opened?: boolean;
}

// Opened, and it has an "once opened" place: it's there now, straight inside
// that place (its subcategory belongs to its own place). Otherwise its own
// place.
export function placeOf(item: Placed): { location: string; subcategory: string } {
  const openedPlace = (item.opened_location ?? "").trim();
  if (item.opened && openedPlace && openedPlace.toLowerCase() !== item.location.trim().toLowerCase())
    return { location: openedPlace, subcategory: "" };
  return { location: item.location, subcategory: item.subcategory };
}

// "Coles, White Mill" -> ["Coles", "White Mill"].
export function brandsOf(text: string | undefined): string[] {
  return (text ?? "")
    .split(",")
    .map((brand) => brand.trim())
    .filter(Boolean);
}

// Whether the app should fetch an item's photo from its store link by
// itself (pantryPhoto.ts): it has a link and no photo, and that link hasn't
// been tried yet. A tried link stays tried whether its photo came, the
// store had none, or someone removed it afterwards (then it stays removed,
// on every phone). A new link gets tried.
export function wantsLinkPhoto(item: { store_url?: string; photo?: string; photo_link_tried?: string }): boolean {
  const link = (item.store_url ?? "").trim();
  return !!link && !item.photo && (item.photo_link_tried ?? "") !== link;
}

// The brands with one more (no repeats, ignoring capitals), as text again.
export function withBrand(text: string | undefined, brand: string): string {
  const brands = brandsOf(text);
  const extra = brand.trim();
  if (extra && !brands.some((b) => b.toLowerCase() === extra.toLowerCase())) brands.push(extra);
  return brands.join(", ");
}
