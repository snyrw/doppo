"use client";

import logo from "../logo-blue.png";
import Image from "next/image";
import AuthButtons from "./AuthModal";
import Link from "next/link";

export default function Navbar({ actions }: { actions?: React.ReactNode }) {
  return (
    <header
      style={{
        background: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 14px",
        height: 50,
        borderBottom: "1px solid #f3f4f6",
        flexShrink: 0,
        zIndex: 40,
        position: "relative",
      }}
    >
      <Link href="/" style={{ display: "flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
        <Image className="h-8 w-8" src={logo} alt="Logo" />
        <span style={{ color: "#60a5fa", fontWeight: 700, fontSize: 16 }}>logitlensviz</span>
      </Link>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {actions}
        <AuthButtons />
      </div>
    </header>
  );
}
