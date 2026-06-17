import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Recursive — the UI / body voice (proportional, linear). One variable family;
// we use its default proportional-linear instance (MONO 0, CASL 0) and lean on
// tabular-nums for numeric column alignment instead of a monospace cut.
const recursive = localFont({
  src: "./fonts/RecursiveVar.woff2",
  variable: "--font-recursive",
  weight: "300 1000",
  display: "swap",
});

// Monaspace Xenon — slab-serif, reserved for editorial display moments.
const xenon = localFont({
  src: "./fonts/MonaspaceXenonVar.woff2",
  variable: "--font-xenon",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Doppo",
  description: "Visualize token predictions at every layer of a transformer model. No code required.",
  icons: [],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${recursive.variable} ${xenon.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/lightlogo.png" media="(prefers-color-scheme: light)" />
        <link rel="icon" href="/darklogo.png" media="(prefers-color-scheme: dark)" />
        {/* Runs before React hydration to set theme and favicon without flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme"),d=window.matchMedia("(prefers-color-scheme:dark)").matches,dark=(t?t==="dark":d);document.documentElement.setAttribute("data-theme",dark?"dark":"light");var l=document.createElement("link");l.rel="icon";l.href=dark?"/darklogo.png":"/lightlogo.png";document.head.appendChild(l);new MutationObserver(function(){var dark=document.documentElement.getAttribute("data-theme")==="dark";l.href=dark?"/darklogo.png":"/lightlogo.png";}).observe(document.documentElement,{attributes:true,attributeFilter:["data-theme"]});}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
