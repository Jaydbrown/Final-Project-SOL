import React from "react";
import { ArrowRight, PlayCircle } from "lucide-react";

const Hero: React.FC<{ onLaunch: () => void }> = ({ onLaunch }) => {
  return (
    <section className="relative pt-16 pb-20 lg:pt-24 lg:pb-32 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col lg:flex-row items-center gap-12">
        <div className="flex-1 text-center lg:text-left z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 sage-text text-xs font-bold uppercase tracking-wider mb-6">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Community Investment Platform
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-900 leading-[1.1] mb-6">
            Invest in Your Neighborhood,{" "}
            <span className="sage-text">Together</span>
          </h1>
          <p className="text-lg text-slate-600 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
            Communities create local investment groups, add members, vote on
            projects with USDC, and share returns transparently.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
            <button
              onClick={onLaunch}
              className="navy-bg text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:translate-y-[-2px] transition-transform shadow-lg shadow-slate-900/20 active:translate-y-[0]"
            >
              Launch App
              <ArrowRight className="w-5 h-5" />
            </button>
            <a
              href="https://youtu.be/TtE1mm7DtrA"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white border-2 border-slate-200 text-slate-700 px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors active:bg-slate-100"
            >
              <PlayCircle className="w-5 h-5" />
              Learn How It Works
            </a>
          </div>
        </div>

        <div className="flex-1 relative w-full max-w-[600px] aspect-[4/3] lg:aspect-square">
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden shadow-2xl rotate-2">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/f/f3/Memphis_Tennessee-2014.jpg"
              alt="Local Neighborhood"
              className="w-full h-full object-cover filter blur-[2px] opacity-80"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-900/40 to-transparent"></div>
          </div>
          <div className="absolute inset-0 z-10 flex items-center justify-center opacity-40 pointer-events-none">
            <svg viewBox="0 0 400 400" className="w-full h-full text-white/40">
              <circle cx="100" cy="100" r="4" fill="currentColor" />
              <circle cx="300" cy="120" r="4" fill="currentColor" />
              <circle cx="150" cy="280" r="4" fill="currentColor" />
              <circle cx="320" cy="300" r="4" fill="currentColor" />
              <circle cx="50" cy="320" r="4" fill="currentColor" />
              <path
                d="M100 100 L300 120 M300 120 L320 300 M320 300 L150 280 M150 280 L100 100 M100 100 L50 320 M50 320 L150 280"
                stroke="currentColor"
                strokeWidth="1"
                fill="none"
                strokeDasharray="5,5"
              />
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
