# Bentotachi: the vision

What Bentotachi is, who it's for, how it talks and looks, and what it won't
become. Check new screens, wording and features against this. It changes
when Xel decides something new: update it then, with the date.

Items marked *(guess)* are first drafts that Xel hasn't confirmed yet.

## What it is

A recipe box, dinner planner, shopping list and pantry for a household,
starring a screaming onigiri. Made by Xel for their own household first,
then shared with friends, and later anyone on Google Play who likes it.

It's **for** households and friend groups who want a free, private recipe
app with some personality, and don't mind it being a bit unhinged.

It's **not for** everyone. Bentotachi doesn't water itself down to appeal
to a general audience (decided 2026-11-01).

## Promises

These don't bend:

- **Free, and staying free.** No subscriptions, no ads, no "premium" tier,
  no paid features. The licence (PolyForm Noncommercial) stops anyone
  selling it either.
- **Your data stays yours.** It lives on your phone, or on a server you or
  someone you know runs. There's no company server in the middle, and the
  developer never sees it.
- **No tracking.** No analytics, no ad networks, no sign-up with anyone.
- **Always takeable.** Backups whenever you like, and a Paprika export to
  move to another app. Bentotachi never holds recipes hostage. (Yummly shut
  down in December 2024 and its users' libraries went with it.)
- **Support is optional** (decided 2026-11-01): a tip link (like Ko-fi) on
  the website and GitHub, and a quiet one in the sideloaded app's menu.
  Never in the Google Play app (Google pulls apps over donation links, and
  its own billing would show Xel's address publicly), never a nag, and it
  never unlocks anything.

## Where it runs

- **Android:** phone-only (the default, nothing to set up) or connected to
  a household server.
- **Desktop:** the same app in any desktop browser, connected to a server,
  which can be a PC in the house. Best for big jobs, like importing a pile
  of bookmarked recipes (decided 2026-11-01).
- **The gap:** a phone-only household can't use a desktop browser, as the
  data is only on the phone. The way across is back up on the phone, set
  up a server, and restore there; a guided version is planned.
- **iPhone:** no app planned. The browser version with a server might work
  in Safari, but nobody has tried it. *(guess)*

## Voice

Cheeky and silly wherever it can afford to be, while staying clear.

- **The joke never replaces the information.** Say the thing plainly, then
  be silly next to it: "It even works in the supermarket's no-signal
  corner" (it works offline), "skips the blogger's life story" (it imports
  just the recipe).
- **Serious moments stay plain.** Deleting, losing data, backups, restores,
  passwords and the privacy policy get calm, clear wording and no jokes:
  people need to trust them. *(guess)*
- **Buttons and warnings say what they do** ("Delete everything", "Save a
  backup"), never a pun. *(guess)*
- **Where the cheek goes in the app:** empty screens ("No recipes yet"),
  hints, success messages and small print. *(guess: the app's text is
  plain so far; the website has the voice.)*
- **Running jokes:** the screaming (the mascot, "besides screaming",
  "complaints about the screaming"), and the onigiri being "fine,
  actually". Use them, don't wear them out.
- **No digs at named competitors.** "No subscriptions" says it; naming and
  shaming another app invites trouble, and Play's listing rules forbid it.
- Plain English underneath: short sentences, no jargon, spell things out.

## Look

**Name and title.** "Bentotachi" (Bento for short; "-tachi" makes it a
group: the bento gang). The title is Xel's drawn lettering, as SVGs:
`branding/make_svg_title.py` makes a light version (brown letters) and a
dark one (cream letters), with an umeboshi by the "B" (the pickled plum
inside an onigiri, with a little puddle of juice), a jade leaf on the "i"
with baran's ridges (the green divider in a bento box), and an orange
chopstick underline. Together with the mascot it's one bento: the filling,
the divider, the chopsticks, the rice.

**Mascot.** Ben (to us; the app needn't name him), a screaming onigiri
skewered on orange chopsticks (`branding/make_svg_mascot.py`). The scream is
the point. Every part is its
own shape, so moods can change the eyes, add sweat, take a bite out of it.

- **Each detail once.** The umeboshi is in the title, so the mascot doesn't
  get one (friends found the old sakura on both too much).
- **Ben's moods** (`branding/make_ben_moods.py`, built from his own SVG so
  they always match him): sweating at an empty pantry, screaming (>< eyes,
  a grain of rice flying off) by an import error, bitten beside "Delete
  everything", holding his chopsticks on "No recipes yet", and a halo by
  "Backup saved." One or two details each: ChatGPT's mockups had more, and
  less is clearer. He keeps his orange chopsticks in every mood. Big (120
  px) on empty screens, small (72 px) beside a message. The words beside
  him still carry the information.
- Detailed versions where there's room, simple ones where it's small (the
  app icon, next to the title).

**Colours** (the app's own, in `web/src/styles.css`; light and dark):

| | Light | Dark |
|---|---|---|
| Background | #FAF6F1 cream | #1C1917 |
| Cards | #FFFFFF | #27221F |
| Text | #2B2420 | #F1EBE5 |
| Accent (buttons, links) | #B4532A terracotta | #E07A4F |
| Soft accent (icon background) | #F6E4DA peach | #3A2A22 |
| Logo chopsticks | #C8643A (clear on both) | #C8643A |
| Jade, the second accent (the leaf) | #5A9A8A | #5A9A8A |
| Jade tags, website note | #E2EFEB soft jade | #243631 |
| Jade selected tag | #3F7668, white text | #7FBFAE, dark text |
| Jade text ("Saved.") | #3A7062 | #8FD3C1 |

**Orange and jade** (decided 2026-11-01: teal is Xel's favourite, and it's
the colour opposite orange). Orange is for doing things: buttons, links,
the chopsticks. Jade is for labels and good news: tags, success messages,
the website's note, the title's leaf. Add jade where it can afford to, not
on buttons. The plain jade (#5A9A8A) is only 3:1 on cream, so it's for
shapes, never text; use the text shades above.

The pantry's Have / Low / Out colours stay green, amber and red: they mean
something at a glance.

**Type.** The phone's own font (system-ui), so it reads like a normal app;
the drawn title carries the personality.

**Follows the phone.** Light or dark mode comes from the phone's setting.

## What it won't become

- A social network: no public feed, followers or recipe sharing with
  strangers. Sharing is with your household. *(guess)*
- An AI recipe writer or meal "suggester". *(guess)*
- Anything with ads, subscriptions, a paid tier or tracking.
- Anything that needs a company server to work.
- A general-audience app that sands off the personality.

## Open questions

- In-app voice: how cheeky do empty screens and messages get, and when?
- Mascot moods: which ones first, and who draws them (ChatGPT plus a
  traced SVG, like the mascot)?
- iPhone: try the browser version in Safari with a server?
- Languages: English only for now (the Dutch tester will see English).

## Decided so far

- 2026-10-30: renamed from Cookbook to Bento.
- 2026-10-31: phone-only is the default; a server is the extra for sharing.
- 2026-11-01: renamed Bentotachi ("Bento" alone is crowded); new drawn
  title; the mascot is the screaming onigiri on chopsticks; silly is
  welcome, not aiming at everyone; no subscriptions, ever; store logos stay
  inside the app (not in the Play listing); a desktop browser version via a
  server is part of the plan; the title's leaf gets baran ridges, in jade,
  and jade becomes the second accent (tags, success messages); an
  umeboshi replaces the title's sakura.
