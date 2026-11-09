import { useEffect, useRef, useState } from "react";
import { currentSection, jumpTarget, stillTapped, type JumpSection } from "./recipeJump";
import { pageScroller, pageScrollTarget } from "./pageScroll";

// The recipe page's Ingredients · Method · Notes switch: it sits above the
// ingredients and sticks under the top bar while you scroll through them,
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
  // Just under the top bar, whatever its height on this phone.
  const [top, setTop] = useState(0);

  // Where each section is now, how far down the screen the bars reach, and
  // how far the page can scroll.
  // Positions are within the scrolling page, which starts at the top of the
  // screen (pageScroll.ts).
  function measure(): { places: JumpSection[]; offset: number; maxScroll: number } {
    const page = pageScroller();
    const places = sections.flatMap(({ id }) => {
      const element = document.getElementById(id);
      if (!element) return [];
      const box = element.getBoundingClientRect();
      return [{ key: id, top: box.top + page.scrollTop, bottom: box.bottom + page.scrollTop }];
    });
    const offset = top + (bar.current?.offsetHeight ?? 0) + 8;
    const maxScroll = page.scrollHeight - page.clientHeight;
    return { places, offset, maxScroll };
  }

  const ids = sections.map((section) => section.id).join(",");
  useEffect(() => {
    const topbar = document.querySelector<HTMLElement>(".topbar");
    const page = pageScrollTarget();
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setTop(topbar?.offsetHeight ?? 0);
        const { places, offset, maxScroll } = measure();
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
    // measure() reads the latest sections and top when it runs.
  }, [ids, top]);

  function jump(id: string) {
    const { places, offset, maxScroll } = measure();
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
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    page.scrollTo({ top: next.scrollTo, behavior: smooth ? "smooth" : "auto" });
  }

  if (sections.length < 2) return null;
  return (
    <nav ref={bar} className="recipe-jump" style={{ top }} aria-label="Jump to">
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
