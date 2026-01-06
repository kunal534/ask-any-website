"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Globe, Zap, MessageSquare, Github, Sparkles, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let sanitized = input.trim();
    if (!sanitized) return;
    sanitized = sanitized.replace(/^https?:\/\//, "");
    window.location.href = `/https://${sanitized}`;
  };

  return (
    <main className="relative min-h-screen bg-black text-white overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
      </div>

      {/* Grid Pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-[size:72px_72px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-4 py-12">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-xl">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-sm text-gray-300">Powered by Mistral AI & Pinecone</span>
        </div>

        {/* Hero */}
        <div className="max-w-4xl mx-auto text-center space-y-6 mb-12">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent">
              Chat with Any Website
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Transform any webpage into an interactive AI assistant. Just paste a URL and start asking questions.
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSubmit} className="w-full max-w-3xl mb-16">
          <div className="relative group">
            {/* Glow Effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl blur-lg opacity-25 group-hover:opacity-50 transition duration-300" />
            
            <div className="relative flex items-center bg-white/5 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden">
              <div className="flex items-center pl-6 pr-4">
                <Globe className="w-5 h-5 text-gray-400" />
              </div>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="https://docs.python.org"
                className="flex-1 bg-transparent px-2 py-5 text-white placeholder:text-gray-500 focus:outline-none text-lg"
              />
              
              <button
                type="submit"
                disabled={!input.trim()}
                className="m-2 flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-800 disabled:to-gray-800 disabled:text-gray-600 text-white rounded-xl font-semibold transition-all duration-200 disabled:cursor-not-allowed group/btn"
              >
                <span>Start Chat</span>
                <ArrowRight className="w-5 h-5 group-hover/btn:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </form>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl w-full">
          <FeatureCard
            icon={<Globe className="w-6 h-6 text-purple-400" />}
            title="Universal Indexing"
            description="Automatically crawls and indexes any public website"
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-blue-400" />}
            title="Real-Time Answers"
            description="Get instant responses powered by advanced AI"
          />
          <FeatureCard
            icon={<MessageSquare className="w-6 h-6 text-pink-400" />}
            title="Context-Aware"
            description="RAG-powered retrieval for accurate information"
          />
        </div>

        {/* How It Works */}
        <div className="mt-24 max-w-4xl w-full">
          <h2 className="text-3xl font-bold text-center mb-12 bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            How It Works
          </h2>
          
          <div className="grid md:grid-cols-4 gap-6">
            <StepCard
              number="1"
              icon={<Globe className="w-5 h-5" />}
              title="Paste URL"
              description="Enter any website link"
            />
            <StepCard
              number="2"
              icon={<Sparkles className="w-5 h-5" />}
              title="Index Content"
              description="AI crawls & processes"
            />
            <StepCard
              number="3"
              icon={<MessageSquare className="w-5 h-5" />}
              title="Ask Questions"
              description="Chat naturally"
            />
            <StepCard
              number="4"
              icon={<CheckCircle2 className="w-5 h-5" />}
              title="Get Answers"
              description="Accurate responses"
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 flex items-center gap-8 text-gray-500 text-sm">
          <Link
            href="https://github.com/kunal534/ask-any-website"
            className="flex items-center gap-2 hover:text-white transition-colors"
            target="_blank"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </Link>
          
          <span className="text-gray-700">•</span>
          
          <Link
            href="https://kunal-uttam.netlify.app"
            className="hover:text-white transition-colors"
            target="_blank"
          >
            Portfolio
          </Link>
        </footer>
      </div>
    </main>
  );
}

function FeatureCard({ icon, title, description }: { 
  icon: React.ReactNode; 
  title: string; 
  description: string 
}) {
  return (
    <div className="group relative">
      <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-600/50 to-blue-600/50 rounded-2xl blur opacity-0 group-hover:opacity-100 transition duration-300" />
      
      <div className="relative p-8 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 hover:border-white/20 transition-all duration-300">
        <div className="mb-4">{icon}</div>
        <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
        <p className="text-gray-400 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function StepCard({ number, icon, title, description }: { 
  number: string;
  icon: React.ReactNode;
  title: string; 
  description: string 
}) {
  return (
    <div className="relative text-center group">
      <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-white/5 border border-white/10 group-hover:border-purple-500/50 transition-all">
        <div className="text-purple-400">{icon}</div>
      </div>
      
      <div className="absolute -top-2 -left-2 w-8 h-8 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center text-xs font-bold">
        {number}
      </div>
      
      <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  );
}
