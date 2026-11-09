import title from "./assets/bentotachi-title.svg";
import titleDark from "./assets/bentotachi-title-dark.svg";
import logo from "./assets/onigiri.svg";
import benBitten from "./assets/ben-bitten.svg";
import benHalo from "./assets/ben-halo.svg";
import benReady from "./assets/ben-ready.svg";
import benScream from "./assets/ben-scream.svg";
import benSweat from "./assets/ben-sweat.svg";
import { useDarkMode } from "./theme";

// The "Bentotachi" title, in dark letters or (in dark mode) cream ones:
// dark mode as chosen in Settings (theme.ts), which a <picture>'s media
// can't follow.
export function BentoTitle({ className }: { className?: string }) {
  const dark = useDarkMode();
  return <img src={dark ? titleDark : title} alt="Bentotachi" className={className} />;
}

// The onigiri, decorative (pair it with the title).
export function BentoLogo({ className }: { className?: string }) {
  return <img src={logo} alt="" className={className} />;
}

// The onigiri (Ben, to us) in a mood, for empty screens and messages
// (branding/make_ben_moods.py). Decorative: the text beside it says it all.
const MOODS = { bitten: benBitten, halo: benHalo, ready: benReady, scream: benScream, sweat: benSweat };

export function BenMood({ mood, small }: { mood: keyof typeof MOODS; small?: boolean }) {
  return <img src={MOODS[mood]} alt="" className={small ? "ben-mood small" : "ben-mood"} />;
}
