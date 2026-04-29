"use client";

import { useState, useEffect } from "react";
import logo from "../logo-blue.png";
import Image from "next/image";
import AuthButtons from "../components/AuthModal";
import HeatmapPanel from "../components/HeatmapPanel";
import Link from "next/link";

type ModelInfo = {
  id: string;
  display_name: string;
  requires_hf_token: boolean;
};

export default function Projects() {
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);

  useEffect(() => {
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/models`)
      .then((r) => r.json())
      .then((models) => setAvailableModels(models))
      .catch(() => setAvailableModels([{ id: "gpt2-small", display_name: "GPT-2 Small", requires_hf_token: false }]))
      .finally(() => setModelsLoading(false));
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 text-black">
      <header className="bg-white font-bold mb-0 flex justify-between shrink-0">
        <Link href="/" className="flex p-3 items-center">
          <Image className="h-9 w-9" src={logo} alt="Logo" />
          <div className="text-blue-400 font-bold text-xl p-1">logitlensviz</div>
        </Link>
        <div className="space-x-3 p-3 flex items-center">
          <button className="bg-white text-lg font-thin text-blue-400 px-3 py-1 rounded outline-2 outline-solid hover:bg-blue-100 transition-colors">
            Export
          </button>
          <AuthButtons />
        </div>
      </header>

      <main className="flex-1 p-4">
        <div
          className="grid grid-cols-2 grid-rows-2 gap-4 h-full"
          style={{ minHeight: "calc(100vh - 64px - 2rem)" }}
        >
          {[0, 1, 2, 3].map((i) => (
            <HeatmapPanel
              key={i}
              availableModels={availableModels}
              modelsLoading={modelsLoading}
            />
          ))}
        </div>
      </main>
    </div>
  );
}
