import type { Metadata } from "next";
import { DM_Sans, Libre_Baskerville } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
});

const libre = Libre_Baskerville({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-libre",
});

export const metadata: Metadata = {
  title: "CoP Kasse Attendance",
  description:
    "The Church Of Pentecost — Kasse Assembly, Kumasi. Member attendance with face + thumbprint, online & offline.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${dmSans.variable} ${libre.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
