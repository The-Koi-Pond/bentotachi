// The recipe page's jump bar (RecipeJumpBar.tsx): which section you're
// in, and where a tap takes you. Kept here so the tests can check it.
//
// Like Paprika's Ingredients / Directions tabs, but on one page: jumping away from step 5 to the ingredients and tapping
// Method again goes back to step 5, not the top of the method.

// A section's place on the page, in pixels from the top of the page.
export interface JumpSection {
  key: string;
  top: number;
  bottom: number;
}

// The section being read: the last one whose top has reached the line
// just under the bars (`offset` px down the screen). The first one before
// any have. At the very bottom of the page (`maxScroll`, as far as it
// scrolls), the last one: a short last section (notes) can't scroll up to
// the bars, and would otherwise never count as being read.
export function currentSection(sections: JumpSection[], scrollY: number, offset: number, maxScroll = Infinity): string | null {
  if (sections.length && maxScroll > 0 && scrollY >= maxScroll - 1) return sections[sections.length - 1].key;
  let current = sections[0]?.key ?? null;
  for (const section of sections) if (section.top <= scrollY + offset + 1) current = section.key;
  return current;
}

// Where to scroll for a tap on `to`, and the places remembered after it
// (by section). The section you leave remembers where you were; going
// back returns there, if that's still inside it (sections move when one
// is edited or a note is added) and isn't where you already are. Tapping
// the lit one goes to its top.
//
// `lit` is the section last tapped, while the page is still where that
// tap took it (RecipeJumpBar.tsx); it's the one you're in, even where it
// can't reach the bars. Otherwise the one shown lit is currentSection's
// (the last one, at the bottom of the page), but the place is remembered
// under the one whose top you've passed: at the bottom you may be
// reading the method's last steps with the notes lit, and Method should
// bring you back to them.
export function jumpTarget(
  sections: JumpSection[],
  to: string,
  scrollY: number,
  offset: number,
  saved: Record<string, number>,
  maxScroll = Infinity,
  lit: string | null = null
): { scrollTo: number; saved: Record<string, number> } | null {
  const target = sections.find((section) => section.key === to);
  if (!target) return null;
  const shown = lit ?? currentSection(sections, scrollY, offset, maxScroll);
  const top = Math.max(0, target.top - offset);
  if (shown === to) {
    const { [to]: _forgotten, ...rest } = saved;
    return { scrollTo: top, saved: rest };
  }
  const leaving = lit ?? currentSection(sections, scrollY, offset);
  const next = leaving && leaving !== to ? { ...saved, [leaving]: scrollY } : saved;
  const remembered = saved[to];
  const back =
    remembered !== undefined &&
    Math.abs(remembered - scrollY) > 2 &&
    remembered + offset >= target.top &&
    remembered + offset < target.bottom;
  return { scrollTo: back ? remembered : top, saved: next };
}

// Whether the section last tapped is still the one you're in: the page
// is on its way to where the tap sent it (`to`, from `from`), or there.
// Any scrolling of your own (wheel, finger, keys, scrollbar) moves it off
// that path, which ends it. `arrived` says it got there; one that hasn't
// by `until` (a time, like Date.now()) was stopped on the way, say by a
// finger on the screen, and ends too.
export function stillTapped(tap: { from: number; to: number; arrived: boolean; until: number }, scrollY: number, now: number): boolean {
  if (tap.arrived) return Math.abs(scrollY - tap.to) <= 2;
  if (now > tap.until) return false;
  return scrollY >= Math.min(tap.from, tap.to) - 2 && scrollY <= Math.max(tap.from, tap.to) + 2;
}
