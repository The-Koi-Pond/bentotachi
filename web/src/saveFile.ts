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

export async function saveFile(name: string, mime: string, bytes: Uint8Array): Promise<boolean> {
  if (isAndroidApp) {
    await Files.begin();
    for (let at = 0; at < bytes.length; at += PIECE) await Files.append({ data: base64(bytes.subarray(at, at + PIECE)) });
    return (await Files.save({ name, mime })).saved;
  }
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}
