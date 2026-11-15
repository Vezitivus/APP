import type { Metadata } from "next";
import { Cormorant_Garamond, Outfit } from "next/font/google";
import "./globals.css";

const serif = Cormorant_Garamond({ subsets: ["latin", "latin-ext"], weight: ["500", "600"], variable: "--font-serif" });
const sans = Outfit({ subsets: ["latin", "latin-ext"], weight: ["300", "400", "500", "600"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "MELNĀ KASTE",
  description: "Pasākuma spēle ar režiju, TV ekrānu un dalībnieku kartītēm.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="lv">
      <body className={`${serif.variable} ${sans.variable}`}>{children}</body>
    </html>
  );
}
