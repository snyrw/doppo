"use client";

import { useState } from "react";
import logo from "./logo-blue.png";
import Image from "next/image";

export default function Home() {
  // Gemini is dumb, hardcoded the prompt into the frontend
  const [prompt, setPrompt] = useState("The capital of France is Paris. The capital of Germany is");
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const runLogitLens = async () => {
    setIsLoading(true);
    setError("");
    setData(null);

    try {
      const response = await fetch("http://localhost:8000/api/run-lens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Sending the exact payload your Pydantic model expects
        body: JSON.stringify({
          prompt: prompt,
          model_name: "gpt2-small" // or gpt2-small depending on what you're testing
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch data from backend");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-0 text-black">
      <h1 className="text-3xl bg-white font-bold mb-2 flex justify-between">
        <div className="flex space-x-2 p-3">
          <Image className="h-10 w-10" src={logo} alt="Logo"/>
          <div className="text-blue-400 font-normal text-2xl p-1">logitlensviz</div>
        </div>
        <div className="justify-right space-x-3 p-3">
        <button
          className="bg-white text-lg font-thin text-blue-400 px-3 py-1 rounded outline-2 outline-solid hover:bg-blue-100 disabled:bg-blue-300 transition-colors"
        >
          Export
        </button>
        <button
          className="bg-white text-lg font-thin text-blue-400 px-3 py-1 rounded outline-2 outline-solid hover:bg-blue-100 disabled:bg-blue-300 transition-colors"
        >
          Log In 
        </button>
        <button
          className="bg-white text-lg font-thin text-blue-400 px-3 py-1 rounded outline-2 outline-solid hover:bg-blue-100 disabled:bg-blue-300 transition-colors"
        >
          Sign Up 
        </button>
        </div>
        </h1> {/* Turn this into the header */}

      {/* Control Panel */}
      <div className="bg-white p-4 rounded-lg shadow mb-8 max-w-3xl">
        <label className="block text-sm font-medium text-gray-700 mb-2">Prompt</label>
        <textarea
          className="w-full border border-gray-300 rounded p-2 mb-4"
          rows={3}
          value={"Test"}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          onClick={runLogitLens}
          disabled={isLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-blue-300 transition-colors"
        >
          {isLoading ? "Running Model..." : "Run Logit Lens"}
        </button>
        {error && <p className="text-red-500 mt-2">{error}</p>}
      </div>

      {/* Heatmap Visualization */}
      {data && (
        <div className="bg-white p-6 rounded-lg shadow overflow-x-auto">
          <h2 className="text-xl font-bold mb-4">Results</h2>
          
          <div className="flex flex-col inline-block min-w-max">
            {/* X-Axis (Tokens) */}
            <div className="flex">
              <div className="w-32 shrink-0"></div> {/* Empty top-left corner */}
              {data.x_labels.map((token, i) => (
                <div key={i} className="w-12 shrink-0 text-xs text-center font-mono transform -rotate-45 origin-bottom-left pb-2">
                  {token.replace(' ', ' ')} {/* Visually represents the space token */}
                </div>
              ))}
            </div>

            {/* Y-Axis (Layers) & Heatmap Data */}
            {data.y_labels.map((layerName, yIndex) => (
              <div key={layerName} className="flex items-center">
                
                {/* Layer Label */}
                <div className="w-32 shrink-0 text-xs text-gray-500 font-mono pr-2 text-right">
                  {layerName}
                </div>

                {/* The Colored Cells */}
                {data.heatmap_data[yIndex].map((prob, xIndex) => {
                  return (
                    <div
                      key={`${yIndex}-${xIndex}`}
                      className="w-12 h-8 shrink-0 border border-gray-100 relative group cursor-pointer"
                      // Using inline styles to dynamically set the opacity of the blue color based on probability
                      style={{ backgroundColor: `rgba(59, 130, 246, ${prob})` }}
                      title={`Token: ${data.x_labels[xIndex]}\nLayer: ${layerName}\nProb: ${(prob * 100).toFixed(2)}%`}
                    >
                      {/* Optional: Show text if probability is very high, otherwise hide it */}
                      <span className="opacity-0 group-hover:opacity-100 absolute inset-0 flex items-center justify-center text-[10px] text-black bg-white/70">
                        {prob.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
