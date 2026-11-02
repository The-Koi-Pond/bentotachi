// Pantry items' photos: shrinking them before they're sent, fetching a
// product's photo from its store link, and filling in photos for items
// whose store link hasn't been tried yet (see wantsLinkPhoto).
import { useEffect, useRef, useState } from "react";
import { pantryItems, pb, type PantryItem } from "./pb";
import { wantsLinkPhoto } from "./pantryItem";

// The longest side photos are kept at. The pantry list shows a 160-pixel
// copy and the edit form a bigger one, so this is plenty; a phone camera's
// 4 MB photo comes out around 50 KB.
const LONGEST_SIDE = 600;

// The photo made at most 600 pixels across, as a JPEG on white (a see-
// through PNG would otherwise turn black). If the browser can't read it
// (an iPhone's HEIC photo in some browsers), it's kept as it is, and the
// server says if it can't take it.
export async function shrinkPhoto(photo: Blob): Promise<File> {
  const original = photo instanceof File ? photo : new File([photo], `photo.${photo.type.split("/")[1] || "jpg"}`, { type: photo.type });
  try {
    const bitmap = await createImageBitmap(photo);
    const scale = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
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

// The product photo on a store's page, fetched by the server (browsers
// can't read other sites' pages; see server/pb_hooks/pantry_photo.pb.js).
// Fails like PocketBase's own calls do ({ status, response: { message } }),
// so errorMessage() explains it: status 400 means the store or page said
// no, status 0 that the server couldn't be reached.
export async function photoFromPage(url: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(pb.buildURL("/api/cookbook/photo-from-page"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: pb.authStore.token },
      body: JSON.stringify({ url }),
    });
  } catch {
    throw { status: 0 };
  }
  if (!response.ok) throw { status: response.status, response: await response.json().catch(() => ({})) };
  return response.blob();
}

// While the pantry is open, fetches the store link's photo for each item
// that wants one (wantsLinkPhoto), one at a time: new items added with a
// link, items whose link changed, and items linked before photos existed.
// Each link is tried once (photo_link_tried); if the store had no photo,
// someone can still take or choose one. If the server couldn't be reached,
// it's tried again next time the pantry opens.
export function useLinkPhotos(items: PantryItem[]) {
  const busy = useRef(false);
  // Items (with their link) already tried while the page is open, so a
  // list that hasn't caught up yet doesn't start the same one twice.
  const tried = useRef(new Set<string>());
  const [finished, setFinished] = useState(0);

  useEffect(() => {
    if (busy.current) return;
    const key = (item: PantryItem) => `${item.id} ${item.store_url.trim()}`;
    const next = items.find((item) => wantsLinkPhoto(item) && !tried.current.has(key(item)));
    if (!next) return;
    busy.current = true;
    tried.current.add(key(next));
    const link = next.store_url.trim();
    void (async () => {
      try {
        const photo = await shrinkPhoto(await photoFromPage(link));
        await pantryItems().update(next.id, { photo, photo_link_tried: link });
      } catch (err) {
        // The store said no (or had no photo): don't ask it again.
        if ((err as { status?: number }).status === 400) {
          await pantryItems().update(next.id, { photo_link_tried: link }).catch(() => {});
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
