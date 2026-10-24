import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TXMates - Social Hangout Planner for Friends in Austin, TX",
  description:
    "TXMates is a desktop-first social planning app that brings friends together using AI itinerary generation, shared availability windows, Capital One Nessie budgeting, and authentic Austin activity discovery.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF7F2] text-[#0F172A] selection:bg-teal-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
