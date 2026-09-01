import Image from "next/image";

export function GuestReferralMiniHero({ href }: { href: string }) {
  return (
    <section
      className="guest-referral-mini-hero"
      aria-labelledby="guest-referral-heading"
      data-referral-entry="public-home"
    >
      <div className="guest-referral-mini-copy">
        <p className="guest-referral-mini-kicker">BERYL REFERRALS</p>
        <h2 id="guest-referral-heading">
          Know someone buying or selling property in Nigeria?
        </h2>
        <p>
          Introduce them to Beryl Shelter in a minute. No account needed.
        </p>
        <a className="guest-referral-mini-action" href={href}>
          Fill in their details
        </a>
      </div>
      <div className="guest-referral-mini-art" aria-hidden="true">
        <Image
          src="/images/referrals/referral-hero-collage.png"
          alt=""
          width={618}
          height={595}
          sizes="(max-width: 767px) 84vw, 360px"
        />
      </div>
    </section>
  );
}
