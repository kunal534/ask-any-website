"use client";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  let sanitized = input.trim();

  // Remove protocol if already included
  sanitized = sanitized.replace(/^https?:\/\//, "");

  // Route to clean version
  window.location.href = `/https://${sanitized}`;
};


  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-8 bg-[#1a1a1a] text-[#E0D6C9] cursor-crosshair">
      {/* Header */}
      <div className="w-full max-w-4xl text-center space-y-6">
        <h1 className="text-4xl font-serif tracking-widest font-bold text-[#F5F5DC] drop-shadow-glow">
          ✦ Talk to Any Web Page ✦
        </h1>

        <p className="text-md text-[#c2bdb1]">
          Paste a website link in the route bar and chat with its content.
        </p>

        {/* CRT Style Explanation Box */}
        <div className="mt-8 border border-[#5C4033] rounded-md p-6 bg-[#2c2c2c] shadow-lg backdrop-blur-md">
          <h2 className="text-xl font-semibold mb-4 text-[#F5F5DC]">
            ⌘ How It Works
          </h2>
          <ol className="text-left space-y-3 text-[#D1BFA9] text-sm max-w-xl mx-auto font-mono">
            <li>1. Paste a link like <code>/https://example.com</code></li>
            <li>2. The page is fetched and parsed</li>
            <li>3. Text is embedded into a vector database</li>
            <li>4. Ask anything about the page — in real-time</li>
          </ol>
        </div>

        {/* Terminal-style input */}
        <form
          onSubmit={handleSubmit}
          className="mt-10 w-full max-w-md text-left font-mono text-[#CFCFCF]"
        >
          <label className="block mb-2 text-sm">Terminal:</label>
          <div className="flex items-center bg-[#0d0d0d] border border-[#444] rounded px-3 py-2">
            <span className="mr-2 text-green-400">$</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="https://example.com"
              className="bg-transparent flex-1 text-[#F5F5DC] focus:outline-none"
            />
          </div>
        </form>
      </div>

      {/* Footer */}
      <div className="w-full flex justify-between items-center px-6 mt-12 text-sm text-[#958b80]">
        <div>
          🔗{" "}
          <Link
            href="https://github.com/kunal534/Chat_bot"
            className="underline hover:text-[#A0522D]"
            target="_blank"
          >
            GitHub
          </Link>
        </div>

        <div>
          📇{" "}
          <Link
            href="https://your-portfolio-url.com"
            className="underline hover:text-[#A0522D]"
            target="_blank"
          >
            Portfolio
          </Link>
        </div>
      </div>
    </main>
  );
}