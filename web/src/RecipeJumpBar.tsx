import { useEffect, useRef, useState } from "react";
import { currentSection, jumpTarget, stillTapped, type JumpSection } from "./recipeJump";
import { pageScrollStart, pageScroller, pageScrollTarget } from "./pageScroll";
import { lessMotion } from "./motion";

// The recipe page's Ingredients · Method · Notes switch: it sits above the
// ingredients and sticks at the top while you scroll through them,
// so you can hop between "how much butter?" and "what's next?" without
// scrolling past everything. Each section remembers
// where you were (recipeJump.ts). `sections` name the page elements (by
// id) to jump to; ones not on the page are left out.
export default function RecipeJumpBar({ sections }: { sections: { id: string; label: string }[] }) {
  const bar = useRef<HTMLElement>(null);
  const saved = useRef<Record<string, number>>({});
  // The section last tapped stays lit while the page is where the tap took
  // it (stillTapped): a short section near the end can't reach the line
  // the highlight goes by (on a wide screen, the method), so it would
  // never light otherwise. Scrolling yourself ends it, however you scroll.
  const tapped = useRef<{ key: string; from: number; to: number; arrived: boolean; until: number } | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  // A string, so the effect below reruns only when the sections change.
  const ids = sections.map((section) => section.id).join(",");
  useEffect(() => {
    const page = pageScrollTarget();
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const { places, offset, maxScroll } = measure(ids, bar.current);
        const scrolled = pageScroller().scrollTop;
        const tap = tapped.current;
        if (tap) {
          if (Math.abs(scrolled - tap.to) <= 2) tap.arrived = true;
          if (!stillTapped(tap, scrolled, Date.now())) tapped.current = null;
        }
        setCurrent(tapped.current?.key ?? currentSection(places, scrolled, offset, maxScroll));
      });
    };
    update();
    page.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      page.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [ids]);

  function jump(id: string) {
    const { places, offset, maxScroll } = measure(ids, bar.current);
    const page = pageScroller();
    const scrolled = page.scrollTop;
    const next = jumpTarget(places, id, scrolled, offset, saved.current, maxScroll, tapped.current?.key ?? null);
    if (!next) return;
    saved.current = next.saved;
    // Where the page will really stop (it can't scroll past the end).
    const to = Math.max(0, Math.min(next.scrollTo, maxScroll));
    // A smooth jump takes well under a second and a half.
    tapped.current = { key: id, from: scrolled, to, arrived: Math.abs(scrolled - to) <= 2, until: Date.now() + 1500 };
    setCurrent(id);
    page.scrollTo({ top: next.scrollTo, behavior: lessMotion() ? "auto" : "smooth" });
  }

  if (sections.length < 2) return null;
  return (
    <nav ref={bar} className="recipe-jump" aria-label="Jump to">
      <div className="view-switch">
        {sections.map(({ id, label }) => (
          <button key={id} type="button" aria-current={current === id ? "true" : undefined} onClick={() => jump(id)}>
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}

// Where each section (`ids`, comma-separated) is within the scrolling page
// (pageScroll.ts), how far down it the bar reaches, and how far the page
// can scroll.
function measure(ids: string, bar: HTMLElement | null): { places: JumpSection[]; offset: number; maxScroll: number } {
  const page = pageScroller();
  const start = pageScrollStart() - page.scrollTop;
  const places = ids.split(",").flatMap((id) => {
    const element = id ? document.getElementById(id) : null;
    if (!element) return [];
    const box = element.getBoundingClientRect();
    return [{ key: id, top: box.top - start, bottom: box.bottom - start }];
  });
  const offset = (bar?.offsetHeight ?? 0) + 8;
  const maxScroll = page.scrollHeight - page.clientHeight;
  return { places, offset, maxScroll };
}
