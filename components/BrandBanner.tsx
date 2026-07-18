import Image from "next/image";

type BrandBannerProps = {
  variant?: "hero" | "compact";
};

export function BrandBanner({ variant = "hero" }: BrandBannerProps) {
  if (variant === "compact") {
    return (
      <div className="brand-block">
        <Image
          src="/cop-logo.png"
          alt="The Church of Pentecost"
          width={48}
          height={48}
          className="brand-logo"
          priority
        />
        <div>
          <p className="brand-name">The Church of Pentecost</p>
          <p className="brand-sub">Asokwa Assembly · Kumasi</p>
        </div>
      </div>
    );
  }

  return (
    <header className="cop-banner">
      <div className="cop-banner-inner">
        <Image
          src="/cop-logo.png"
          alt="The Church of Pentecost logo"
          width={96}
          height={96}
          className="cop-banner-logo"
          priority
        />
        <div className="cop-banner-text">
          <p className="cop-banner-org">The Church Of Pentecost</p>
          <h1 className="cop-banner-title">Asokwa Assembly — Kumasi</h1>
          <p className="cop-banner-tag">Member Attendance System</p>
        </div>
      </div>
    </header>
  );
}
