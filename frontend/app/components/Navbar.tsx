"use client";

import logo from "../logo-blue.png";
import Image from "next/image";
import AuthButtons from "./AuthModal";
import Link from "next/link";

export default function Navbar({ actions }: { actions?: React.ReactNode }) {
  return (
    <header
      style={{
        background: "#161b22",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 16px",
        height: 50,
        borderBottom: "1px solid #21262d",
        flexShrink: 0,
        zIndex: 40,
        position: "relative",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
        <Image className="h-8 w-8" src={logo} alt="Logo" />
        <span style={{ color: "#58a6ff", fontWeight: 700, fontSize: 15, letterSpacing: "0.03em" }}>
          logitlensviz
        </span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {actions}
        <AuthButtons />
      </div>
    </header>
  );
}
