import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: "variable",
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
      className={`${ibmPlexSans.variable} h-full antialiased`}
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
