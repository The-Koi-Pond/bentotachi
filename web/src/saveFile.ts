import { registerPlugin } from "@capacitor/core";
import { isAndroidApp } from "./pb";

// Saves a file Bento made (like a recipe export). In a browser it downloads;
// in the Android app, Android asks where to save it (BentoFilesPlugin.java),
// as the app can't download. Whether it was saved (false if cancelled).

interface FilesPlugin {
  begin(): Promise<void>;
  append(options: { data: string }): Promise<void>;
  save(options: { name: string; mime: string }): Promise<{ saved: boolean }>;
}

const Files = registerPlugin<FilesPlugin>("BentoFiles");

// 768 KB a piece (1 MB once in base64).
const PIECE = 768 * 1024;

function base64(bytes: Uint8Array): string {
  let text = "";
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}

// A file saved a piece at a time as it's made (a big recipe export), so it
// never has to be in memory whole on a phone: add() the pieces in order,
// then save() asks where (Android) or downloads it (a browser, which keeps
// the pieces until then).
export async function startFile(): Promise<{ add: (bytes: Uint8Array) => Promise<void>; save: (name: string, mime: string) => Promise<boolean> }> {
  if (isAndroidApp) {
    await Files.begin();
    // Whatever arrives fills one PIECE-sized buffer, sent to Android each
    // time it's full (and the rest at the end), so no piece is bigger.
    const buffer = new Uint8Array(PIECE);
    let filled = 0;
    const flush = async () => {
      if (!filled) return;
      const piece = buffer.subarray(0, filled);
      filled = 0;
      await Files.append({ data: base64(piece) });
    };
    return {
      add: async (bytes) => {
        let at = 0;
        while (at < bytes.length) {
          const take = Math.min(PIECE - filled, bytes.length - at);
          buffer.set(bytes.subarray(at, at + take), filled);
          filled += take;
          at += take;
          if (filled === PIECE) await flush();
        }
      },
      save: async (name, mime) => {
        await flush();
        return (await Files.save({ name, mime })).saved;
      },
    };
  }
  const pieces: BlobPart[] = [];
  return {
    add: async (bytes) => {
      pieces.push(bytes as BlobPart);
    },
    save: async (name, mime) => {
      download(name, new Blob(pieces, { type: mime }));
      return true;
    },
  };
}

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
