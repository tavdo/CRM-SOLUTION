import Link from "next/link";

export function LegalLinks({ locale }: { locale: string }) {
  const ka = locale === "ka";
  return <nav aria-label={ka ? "ინფორმაცია და დახმარება" : "Information and support"} style={{ display: "flex", flexWrap: "wrap", gap: "0.65rem 1.1rem", fontSize: "0.85rem" }}>
    <Link href={`/${locale}/privacy`}>{ka ? "კონფიდენციალურობა" : "Privacy"}</Link>
    <Link href={`/${locale}/terms`}>{ka ? "გამოყენების პირობები" : "Terms"}</Link>
    <Link href={`/${locale}/contact`}>{ka ? "დაგვიკავშირდი" : "Contact"}</Link>
  </nav>;
}
