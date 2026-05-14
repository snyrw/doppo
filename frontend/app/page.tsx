import Navbar from "./components/Navbar";
import HeroContent from "./components/HeroContent";

export default function Home() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "var(--color-bg)",
        overflow: "hidden",
      }}
    >
      <Navbar />
      <HeroContent />
    </div>
  );
}
