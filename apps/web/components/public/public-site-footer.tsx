import Image from "next/image";
import { BrandLogo } from "../auth/brand-logo";

const groups=[
  ["Properties for Sale",["Commercial Properties","Houses","Flats / Apartments","Detached Duplex","Land Plots","Semi-Detached Duplex","Terraced Duplex"]],
  ["New Developments",["Upcoming Projects","Pre-construction deals","Gated Communities","Smart Homes","Eco-Friendly Buildings"]],
  ["Popular Destinations",["Ikeja, Lagos","Rukpokwu, PH","Asaba, Delta","VI, Lagos","Abuja","Ibadan","Warri, Delta"]],
  ["Company",["Terms of Service","Privacy Policy","Report","Support"]],
] as const;

export function PublicSiteFooter(){return <footer className="site-footer"><div className="site-footer-grid">
  <section className="site-footer-about"><BrandLogo size={31}/><h2>About Us</h2><p>Since incorporation in 2001, Beryl Prestige Living has embarked on a number of strategic initiatives to expand the growth of its real estate market share in Nigeria and ensure strong continuous relevance.</p><small>© 2026 Beryl Prestige Living. All rights reserved.</small></section>
  {groups.map(([title,items])=><section key={title}><h2>{title}</h2>{items.map(item=><span key={item}>{item}</span>)}</section>)}
  <section className="site-footer-contact"><h2>Contact Enquiries</h2><p>Email: info@berylprestigeliving.com<br/>Phone: 0704 205 5678<br/>Address: Plot 2, Cornerstone Estate Drive, Ikate-Elegshi, Lekki, Lagos</p></section>
  <section className="site-footer-app"><h2>Download our mobile app</h2><div className="store-badges"><Image src="/landing/footer-app-store.png" alt="Download on the App Store" width={599} height={175} loading="eager" unoptimized/><Image src="/landing/footer-google-play.png" alt="Get it on Google Play" width={290} height={84} loading="eager" unoptimized/></div></section>
</div></footer>}
