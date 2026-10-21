import type { Metadata } from "next";
import { Bricolage_Grotesque, Plus_Jakarta_Sans, Space_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space-mono",
  display: "swap",
});

const title = "See Ya! — sort the date, see everyone there";
const description =
  "The fun way to pin down a plan. Toss out a few dates, drop a pin on the venue, and let everyone tick what works. All parties get an emailed copy, and fresh invites fly out the moment anything changes.";

export const metadata: Metadata = {
  title,
  description,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000",
  ),
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${bricolage.variable} ${jakarta.variable} ${spaceMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
