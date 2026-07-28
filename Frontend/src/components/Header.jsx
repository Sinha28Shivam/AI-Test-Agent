import React from 'react';
import { Cpu, Database, Activity, Play, Zap, Search } from 'lucide-react';

export default function Header({ activeRunsCount = 0, onQuickLaunch }) {
  return (
    <header className="h-16 border-b border-gray-800 bg-[#0D1515]/90 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-50">
      {/* Brand & Logo */}
      <div className="flex items-center space-x-3">
        <div className="w-9 h-9 rounded-lg gradient-bg p-0.5 flex items-center justify-center shadow-lg glow-cyan">
          <div className="w-full h-full bg-[#0B0F19] rounded-[7px] flex items-center justify-center">
            <Zap className="w-5 h-5 text-[#00F2FE]" />
          </div>
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-wide gradient-text">LUMEN AI</h1>
          <p className="text-[10px] text-gray-400 font-mono tracking-wider">ENTERPRISE TEST AGENT v3.0</p>
        </div>
      </div>

      {/* Center Search Bar */}
      <div className="relative w-96 hidden md:block">
        <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          placeholder="Search test runs, domains, scenarios..."
          className="w-full bg-[#151D1E] border border-gray-800 rounded-md py-1.5 pl-9 pr-4 text-sm text-gray-200 focus:outline-none focus:border-[#00F2FE] transition-colors"
        />
      </div>

      {/* System Status Indicators */}
      <div className="flex items-center space-x-6 text-xs font-mono">
        <div className="flex items-center space-x-2 bg-[#151D1E] px-3 py-1.5 rounded-md border border-gray-800">
          <Activity className="w-3.5 h-3.5 text-[#00F2FE] animate-pulse" />
          <span className="text-gray-400">Runs:</span>
          <span className="text-white font-bold">{activeRunsCount}</span>
        </div>

        <div className="flex items-center space-x-2 bg-[#151D1E] px-3 py-1.5 rounded-md border border-gray-800">
          <Cpu className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-gray-400">Engine:</span>
          <span className="text-gray-200">GitHub Copilot</span>
        </div>

        <div className="flex items-center space-x-2 bg-[#151D1E] px-3 py-1.5 rounded-md border border-gray-800">
          <Database className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-gray-400">DB:</span>
          <span className="text-emerald-400 font-semibold">Postgres / Mongo</span>
        </div>

        <button 
          onClick={onQuickLaunch}
          className="gradient-bg hover:opacity-90 text-white font-medium px-4 py-1.5 rounded-md flex items-center space-x-1.5 shadow-md hover:shadow-[#00F2FE]/20 transition-all cursor-pointer"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Launch Run</span>
        </button>
      </div>
    </header>
  );
}
