import { useEffect } from "react";
import { useNavigate } from "react-router";
import { registerPlugin } from "@capacitor/core";
import { isAndroidApp } from "./pb";
import { sharedLink } from "./recipeSites";
import { isStoreLink } from "./stores";

// "Share to Bento" (BentoSharePlugin.java in the Android project).
interface BentoSharePlugin {
  take(): Promise<{ text: string | null }>;
  addListener(event: "shared", listener: () => void): Promise<{ remove: () => Promise<void> }>;
}

const BentoShare = registerPlugin<BentoSharePlugin>("BentoShare");

// When a link is shared to Bento from another app (at start-up, or while
// Bento is open), go to Add recipe and import it there, or, for a store's
// product page (Coles, Woolworths), to the Pantry to add it as an item. Used inside the
// router, so it only runs once someone is logged in.
export function useShareReceiver() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAndroidApp) return;
    let stopped = false;
    const takeShared = async () => {
      const { text } = await BentoShare.take();
      if (stopped || !text) return;
      const link = sharedLink(text);
      if (link && isStoreLink(link)) navigate(`/pantry?add=${encodeURIComponent(link)}`);
      else navigate(link ? `/add?url=${encodeURIComponent(link)}` : "/add?shared=nolink");
    };
    void takeShared().catch(() => {});
    const listening = BentoShare.addListener("shared", () => void takeShared().catch(() => {}));
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
