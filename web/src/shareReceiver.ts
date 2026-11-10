import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { errorMessage, isAndroidApp } from "./pb";
import { sharedLink } from "./recipeSites";
import { isStoreLink } from "./stores";

// "Share to Bento", and sharing from it (BentoSharePlugin.java in the
// Android project).
interface BentoSharePlugin {
  // A file comes copied into the app's cache: its name and where it is.
  take(): Promise<{ text: string | null; file?: SharedFile | null }>;
  send(options: { title: string; text: string }): Promise<void>;
  addListener(event: "shared", listener: () => void): Promise<{ remove: () => Promise<void> }>;
}

const BentoShare = registerPlugin<BentoSharePlugin>("BentoShare");

// A file opened with Bentotachi (a Paprika file from Files, email or chat).
export interface SharedFile {
  name: string;
  path: string;
}

// The opened file's contents, read from the app's cache.
export async function readSharedFile(file: SharedFile): Promise<File> {
  const answer = await fetch(Capacitor.convertFileSrc(`file://${file.path}`));
  if (!answer.ok) throw new Error("Couldn't read that file. Try opening it again.");
  return new File([await answer.arrayBuffer()], file.name);
}

// Shares text from Bento: Android's share sheet in the app, the browser's
// where it has one (phones, Safari, Edge), or else copied, ready to paste.
// Says which happened.
export async function shareText(title: string, text: string): Promise<"shared" | "copied" | "cancelled"> {
  if (isAndroidApp) {
    await BentoShare.send({ title, text });
    return "shared";
  }
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return "shared";
    } catch (err) {
      if ((err as Error).name === "AbortError") return "cancelled";
      // Not allowed here (some desktop browsers): copy it instead.
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}

// When a link is shared to Bento from another app (at start-up, or while
// Bento is open), go to Add recipe and import it there, or, for a store's
// product page (Coles, Woolworths), to the Pantry to add it as an item. Used inside the
// router, so it only runs once someone is logged in.
function useShareReceiver() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAndroidApp) return;
    let stopped = false;
    const takeShared = async () => {
      const { text, file } = await BentoShare.take();
      if (stopped) return;
      // A file (a Paprika file): Import & export offers to import it.
      if (file) {
        navigate("/export", { state: { sharedFile: file } });
        return;
      }
      if (!text) return;
      const link = sharedLink(text);
      if (link && isStoreLink(link)) navigate(`/pantry?add=${encodeURIComponent(link)}`);
      else navigate(link ? `/add?url=${encodeURIComponent(link)}` : "/add?shared=nolink");
    };
    // A file that couldn't be read says so on Import & export, rather than
    // the app opening with nothing (found in review).
    const failed = (err: unknown) => {
      if (!stopped) navigate("/export", { state: { sharedError: errorMessage(err) } });
    };
    void takeShared().catch(failed);
    const listening = BentoShare.addListener("shared", () => void takeShared().catch(failed));
    return () => {
      stopped = true;
      void listening.then((handle) => handle.remove());
    };
  }, [navigate]);
}

// Placed inside the router in App.tsx.
export function ShareReceiver() {
  useShareReceiver();
  return null;
}
