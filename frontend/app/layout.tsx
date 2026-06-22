import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// IBM Plex Sans — the single grotesque voice for display + body (Swiss
// International Typographic style). One variable family across all weights.
const plexSans = localFont({
  src: "./fonts/IBMPlexSansVar.woff2",
  variable: "--font-plex-sans",
  weight: "100 700",
  display: "swap",
});

// IBM Plex Mono — technical/data voice (token cells, logit & probability
// readouts). Not a variable font; ship Regular + Medium as static cuts.
const plexMono = localFont({
  src: [
    { path: "./fonts/IBMPlexMono-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/IBMPlexMono-Medium.woff2", weight: "500", style: "normal" },
  ],
  variable: "--font-plex-mono",
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
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
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
