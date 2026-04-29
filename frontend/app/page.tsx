import Navbar from "./components/Navbar";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-black">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center gap-6">
        <h1 className="text-6xl font-bold">Welcome!</h1>
        <p className="text-lg text-gray-600">
          logitlensviz is an easy, open source logit lens visualizer
        </p>
        <div className="flex gap-4 mt-2">
          <button
            disabled
            className="px-6 py-2 rounded border-2 border-blue-400 text-blue-400 bg-transparent opacity-60 cursor-not-allowed text-lg"
          >
            Tutorial
          </button>
          <Link
            href="/projects"
            className="px-6 py-2 rounded bg-blue-500 text-gray-50 hover:bg-blue-600 transition-colors text-lg"
          >
            Projects
          </Link>
        </div>
      </main>
    </div>
  );
}
