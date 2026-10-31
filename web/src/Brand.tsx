import title from "./assets/bento-title.png";
import titleDark from "./assets/bento-title-dark.png";
import logo from "./assets/bento-logo.png";

// The "Bento" title, in dark letters or (in dark mode) cream ones.
export function BentoTitle({ className }: { className?: string }) {
  return (
    <picture>
      <source srcSet={titleDark} media="(prefers-color-scheme: dark)" />
      <img src={title} alt="Bento" className={className} />
    </picture>
  );
}

// The onigiri, decorative (pair it with the title).
export function BentoLogo({ className }: { className?: string }) {
  return <img src={logo} alt="" className={className} />;
}
