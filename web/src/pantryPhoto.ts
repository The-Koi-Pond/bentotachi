// Pantry items' photos: shrinking them before they're sent, finding a
// product's photo online (Open Food Facts, then its store link), and
// filling in photos for items not looked up yet (see wantsOnlinePhoto).
import { useEffect, useRef, useState } from "react";
import { pantryItems, pb, type PantryItem } from "./pb";
import { barcodesOf } from "./barcodes";
import { photoSources, storeLinksOf, wantsOnlinePhoto } from "./pantryItem";

// The longest side photos are kept at. The pantry list shows a 160-pixel
// copy and the edit form a bigger one, so this is plenty; a phone camera's
// 4 MB photo comes out around 50 KB.
const LONGEST_SIDE = 600;

// The photo made at most 600 pixels across (or `longestSide`: recipes'
// photos keep 1600), as a JPEG on white (a see-through PNG would otherwise
// turn black). If the browser can't read it (an iPhone's HEIC photo in some
// browsers), it's kept as it is, and the server says if it can't take it.
export async function shrinkPhoto(photo: Blob, longestSide = LONGEST_SIDE): Promise<File> {
  const original = photo instanceof File ? photo : new File([photo], `photo.${photo.type.split("/")[1] || "jpg"}`, { type: photo.type });
  try {
    const bitmap = await createImageBitmap(photo);
    const scale = Math.min(1, longestSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return original;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const small = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!small || small.size >= original.size) return original;
    return new File([small], "photo.jpg", { type: "image/jpeg" });
  } catch {
    return original;
  }
}

// A product's photo, found online by the server (browsers can't read other
// sites' pages; see server/pb_hooks/pantry_photo.pb.js): Open Food Facts'
// photo for one of its barcodes, else one of its store pages'. Fails like
// PocketBase's own calls do ({ status, response: { message } }), so
// errorMessage() explains it: status 400 means no photo was found, 503
// that Open Food Facts couldn't be reached, 0 that the server couldn't be.
export async function findPhoto(barcodes: string[], urls: string[]): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(pb.buildURL("/api/cookbook/pantry-photo"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: pb.authStore.token },
      body: JSON.stringify({ barcodes, urls }),
    });
  } catch {
    throw { status: 0 };
  }
  if (!response.ok) throw { status: response.status, response: await response.json().catch(() => ({})) };
  return response.blob();
}

// While the pantry is open, looks up the photo for each item that wants one
// (wantsOnlinePhoto), one at a time: new items added with a barcode or link,
// items whose barcodes or link changed, and items added before photos (or
// Open Food Facts' photos) existed. Each set of them is tried once
// (photo_link_tried); if nothing turned up, someone can still take or choose
// a photo. If the server, a store or Open Food Facts couldn't be reached,
// it's tried again next time the pantry opens.
export function useOnlinePhotos(items: PantryItem[]) {
  const busy = useRef(false);
  // Items (with what they're looked up by) already tried while the page is
  // open, so a list that hasn't caught up yet doesn't start one twice.
  const tried = useRef(new Set<string>());
  const [finished, setFinished] = useState(0);

  useEffect(() => {
    if (busy.current) return;
    const key = (item: PantryItem) => `${item.id} ${photoSources(item)}`;
    const waiting = items.filter((item) => wantsOnlinePhoto(item) && !tried.current.has(key(item)));
    if (!waiting.length) return;
    // A random one, so phones and browsers open at the same time don't all
    // look up the same item at once.
    const next = waiting[Math.floor(Math.random() * waiting.length)];
    busy.current = true;
    tried.current.add(key(next));
    const sources = photoSources(next);
    // Checked against the saved item just before looking it up and before
    // saving: meanwhile someone may have chosen or removed a photo, changed
    // its barcodes or links, or another device may have found it.
    const stillWanted = async () => {
      const now = await pantryItems().getOne(next.id);
      return wantsOnlinePhoto(now) && photoSources(now) === sources;
    };
    void (async () => {
      try {
        if (!(await stillWanted())) return;
        const photo = await shrinkPhoto(await findPhoto(barcodesOf(next), storeLinksOf(next)));
        if (!(await stillWanted())) return;
        await pantryItems().update(next.id, { photo, photo_link_tried: sources });
      } catch (err) {
        // Nothing found: don't ask again.
        if ((err as { status?: number }).status === 400 && (await stillWanted().catch(() => false))) {
          await pantryItems().update(next.id, { photo_link_tried: sources }).catch(() => {});
        }
      } finally {
        busy.current = false;
        setFinished((count) => count + 1);
      }
    })();
  }, [items, finished]);
}

// A temporary address for showing a chosen photo before it's saved.
export function usePreviewUrl(photo: Blob | null | undefined): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!photo) {
      setUrl("");
      return;
    }
    const address = URL.createObjectURL(photo);
    setUrl(address);
    return () => URL.revokeObjectURL(address);
  }, [photo]);
  return url;
}
