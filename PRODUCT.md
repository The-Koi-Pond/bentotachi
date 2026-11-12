# Product

<!-- impeccable:product-schema 1 -->

The short product record the Impeccable design skill reads before design
work. The full story, look and decisions are in `docs/VISION.md`; keep the
two in step.

## Platform

web

(One React app: in any desktop browser against a household server, and on
Android wrapped by Capacitor, in phone-only mode or connected to a server.
Its design language is the app's own, not Android's.)

## Users

- **First:** Xel's own household of three, sharing one recipe box, dinner
  plan, shopping list and pantry, mostly on Android phones in the kitchen
  and at the shops.
- **Then:** friends' households, some hosting their own server.
- **Later:** anyone on Google Play who likes it: households and friend
  groups who want a free, private recipe app with some personality, and
  don't mind it being a bit unhinged.

It's not for everyone, and doesn't water itself down to appeal to a
general audience.

## Product Purpose

One app for a household's food: save recipes (from websites, Paprika files
or by hand), plan dinners, build the shopping list from the plan and the
pantry, and keep track of what's in stock. Success is a household actually
using it every week instead of screenshots, notes apps and three
half-used apps.

## Positioning

Free and private with no company in the middle: the data lives on the
phone or on a server the household (or a friend) runs, and the developer
never sees it. Personality instead of polish-by-numbers: a screaming
onigiri mascot and a cheeky voice that never gets in the way of the facts.

## Operating Context

- In the kitchen with messy hands (step timers, ticking ingredients and
  steps), and in the supermarket's no-signal corner (the list, plan and
  pantry work offline and sync later).
- Several people changing the same lists at once, live.
- Desktop for big jobs, like importing a pile of bookmarked recipes.

## Capabilities and Constraints

- Recipes, the dinner plan, several shopping lists, the pantry (places,
  packets, use-by dates, counts), cooking (timers, "Used anything up?"),
  backups and a Paprika export, phone-only mode or a household server.
- Australian spelling, adapting to the household's region where it matters.
  English only for now.
- Promises that don't bend: free (no ads, subscriptions or paid tier), no
  tracking, no company server, data always takeable (backups, Paprika
  export).
- Won't become: a social network, an AI recipe writer or meal suggester, or
  anything needing a company server.
- iPhone: no app; the browser version is untried in Safari.

## Brand Commitments

- **Name:** "Bentotachi" in anything people see ("Bento" for short).
- **Tagline:** "Because dinner insists on happening every day." A real
  sentence in normal case; no uppercase, dotted eyebrow taglines.
- **Mascot:** Ben, a screaming onigiri on wooden chopsticks; his moods are
  drawn from his own shapes (`branding/`). The title is Xel's drawn
  lettering. The art and the Pond Pebbles font were made with AI help and
  are never called hand-drawn or hand-lettered.
- **Voice** (docs/VISION.md, "Voice"): cheeky and silly where it can
  afford to be, and the joke never replaces the information. Serious
  moments (deleting, losing data, backups, restores, passwords, privacy)
  stay plain with no jokes. Buttons and warnings say what they do, never a
  pun. The cheek goes in empty screens, hints, success messages and small
  print. Tips live behind a small "?". Never "packet" where people read it.
  No digs at named competitors.

## Evidence on Hand

- `docs/VISION.md` (look, voice, decisions), `docs/PLAN.md` (roadmap),
  `docs/RELEASES.md` (what each release brought).
- The mascot, title and moods: `branding/`; app icons and screenshots in
  `web/public` and `docs/screenshots.png`; the Play listing text in
  `docs/PLAY-LISTING.md`.
- No testimonials, reviews, user counts or press: never invent them.

## Product Principles

1. The household's data is theirs: on their phone or their own server,
   always takeable, never held hostage.
2. Works where food happens: offline in the shop, one-handed in the
   kitchen, shared live between the people who cook.
3. Personality next to clarity, never instead of it.
4. Nothing asks for more than it needs: counting stock, dates and lists are
   there for households that want them, never demanded.
5. Free for good, with nothing to upsell.

## Accessibility & Inclusion

WCAG AA as the floor (Xel, 2026-11-12): text contrast 4.5:1 (3:1 for large
text), touch targets at least 44px, usable with a screen reader and with
the phone's largest text size, in light and dark.
