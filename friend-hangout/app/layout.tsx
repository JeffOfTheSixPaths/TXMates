import type { Metadata } from "next";
import { Fraunces, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  weight: "variable",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-source",
  weight: "variable",
});

export const metadata: Metadata = {
  title: "TXMates — plan a hangout your friends will make",
  description:
    "TXMates turns shared free time, a per-person budget, and Austin spots into a short hangout plan. Friends mark their hours on a link, then the group locks an itinerary.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-pine text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-sun focus:px-3 focus:py-2 focus:text-ink"
        >
          Skip to the plan
        </a>
        {children}
      </body>
    </html>
  );
}
