import React, { useState } from 'react';
import { Play, Compass, RefreshCw, Cpu } from 'lucide-react';

export default function TestLauncher({ onRunStarted }) {
  const [prompt, setPrompt] = useState('Navigate to https://www.msn.com/en-in, verify search box and personalized news feed load correctly');
  const [executionMode, setExecutionMode] = useState('explore');
  const [modelEngine, setModelEngine] = useState('copilot');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    try {
      const res = await fetch('/api/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, mode: executionMode, engine: modelEngine })
      });
      const data = await res.json();
      if (onRunStarted) onRunStarted(data);
    } catch (err) {
      console.error('Failed to trigger run:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#1E1E2E] border border-gray-800 rounded-xl p-6 shadow-xl space-y-6">
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Compass className="w-5 h-5 text-[#00F2FE]" />
            <span>AI Test Launcher Console</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Describe test intentions in natural language. Agent auto-discovers target domain & generates Playwright scripts.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-mono font-medium text-gray-300 mb-2 uppercase">
            Test Scenario Prompt / Target URL
          </label>
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Navigate to https://example.com, click sign in, fill email and password..."
            className="w-full bg-[#0B0F19] border border-gray-800 rounded-lg p-3.5 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-[#00F2FE] transition-colors resize-none font-mono"
          />
        </div>

        {/* Configuration Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Mode Selector */}
          <div className="bg-[#151D1E] p-3 rounded-lg border border-gray-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-gray-200 block">Execution Engine Mode</span>
              <span className="text-[11px] text-gray-400 block">
                {executionMode === 'explore' ? 'Dynamic LLM Exploration' : 'Cached Step Replay (95% Token Save)'}
              </span>
            </div>
            <div className="flex bg-[#0B0F19] p-1 rounded-md border border-gray-800 text-xs font-mono">
              <button
                type="button"
                onClick={() => setExecutionMode('explore')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  executionMode === 'explore' ? 'bg-[#00F2FE] text-black font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                Explore
              </button>
              <button
                type="button"
                onClick={() => setExecutionMode('replay')}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  executionMode === 'replay' ? 'bg-[#7F00FF] text-white font-bold' : 'text-gray-400 hover:text-white'
                }`}
              >
                Replay
              </button>
            </div>
          </div>

          {/* Model Engine Selector */}
          <div className="bg-[#151D1E] p-3 rounded-lg border border-gray-800 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-gray-200 block">LLM Provider</span>
              <span className="text-[11px] text-gray-400 block">Hot-switching failover enabled</span>
            </div>
            <select
              value={modelEngine}
              onChange={(e) => setModelEngine(e.target.value)}
              className="bg-[#0B0F19] text-xs font-mono text-gray-200 border border-gray-800 rounded px-2.5 py-1.5 focus:outline-none focus:border-[#00F2FE]"
            >
              <option value="copilot">GitHub Copilot CLI</option>
              <option value="azure">Azure OpenAI Service</option>
              <option value="openai">OpenAI API (gpt-4o)</option>
            </select>
          </div>
        </div>

        {/* Submit Action */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isLoading}
            className="gradient-bg hover:opacity-90 text-white font-semibold px-6 py-2.5 rounded-lg flex items-center space-x-2 shadow-lg shadow-[#00F2FE]/20 transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            <span>{isLoading ? 'Initializing Agent...' : 'Launch AI Scenario Execution'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
