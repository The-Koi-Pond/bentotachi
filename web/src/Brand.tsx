import title from "./assets/bentotachi-title.svg";
import titleDark from "./assets/bentotachi-title-dark.svg";
import logo from "./assets/onigiri.svg";
import benBitten from "./assets/ben-bitten.svg";
import benHalo from "./assets/ben-halo.svg";
import benReady from "./assets/ben-ready.svg";
import benScream from "./assets/ben-scream.svg";
import benSweat from "./assets/ben-sweat.svg";

// The "Bentotachi" title, in dark letters or (in dark mode) cream ones.
export function BentoTitle({ className }: { className?: string }) {
  return (
    <picture>
      <source srcSet={titleDark} media="(prefers-color-scheme: dark)" />
      <img src={title} alt="Bentotachi" className={className} />
    </picture>
  );
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
