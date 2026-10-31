import colesLogo from "./assets/stores/coles.png";
import woolworthsLogo from "./assets/stores/woolworths.png";
import walmartLogo from "./assets/stores/walmart.png";
import targetLogo from "./assets/stores/target.png";
import krogerLogo from "./assets/stores/kroger.png";
import albertHeijnLogo from "./assets/stores/albertheijn.png";
import jumboLogo from "./assets/stores/jumbo.png";
import plusLogo from "./assets/stores/plus.png";
import dirkLogo from "./assets/stores/dirk.png";
import type { Store } from "./stores";

// Each store's own site icon, kept in Bento so showing one doesn't contact
// the store, and works offline. From their websites (Coles, Woolworths
// 2026-10-30; Walmart's and Target's 2026-10-31; Kroger's site icon via
// Google's public site-icon service, as Kroger's page didn't list one),
// saved at 96 px. The Dutch stores' (2026-10-31) came from Google's
// site-icon service too, as Albert Heijn's and Jumbo's sites refuse
// automated visits; Plus's is 48 px, the biggest it has.
const LOGOS: Record<string, string> = {
  Coles: colesLogo,
  Woolworths: woolworthsLogo,
  Walmart: walmartLogo,
  Target: targetLogo,
  Kroger: krogerLogo,
  "Albert Heijn": albertHeijnLogo,
  Jumbo: jumboLogo,
  Plus: plusLogo,
  Dirk: dirkLogo,
};

// A store's logo in place of its name. Screen readers still say the name.
export default function StoreLogo({ store, size = 20 }: { store: Store; size?: number }) {
  const logo = LOGOS[store.name];
  if (!logo) return <>{store.name}</>;
  return <img className="store-logo" src={logo} alt={store.name} title={store.name} width={size} height={size} />;
}
