import title from "./assets/bentotachi-title.svg";
import titleDark from "./assets/bentotachi-title-dark.svg";
import logo from "./assets/onigiri.svg";

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
