import React, { useState, useEffect, useRef } from 'react';
import { Terminal, Globe, Pause, Square, Camera, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function ExecutionMonitor({ logs = [], activePlan = null }) {
  const logContainerRef = useRef(null);
  const [targetUrl, setTargetUrl] = useState('https://www.msn.com/en-in');
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    if (activePlan?.targetUrl) {
      setTargetUrl(activePlan.targetUrl);
    }
  }, [activePlan]);

  return (
    <div className="bg-[#1E1E2E] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
        <div className="flex items-center space-x-2">
          <Terminal className="w-5 h-5 text-[#00F2FE]" />
          <h3 className="font-bold text-white text-base">Real-Time Execution Monitor</h3>
          <span className="bg-[#00F2FE]/10 text-[#00F2FE] border border-[#00F2FE]/30 font-mono text-[10px] px-2 py-0.5 rounded uppercase">
            Live Stream
          </span>
        </div>
        <div className="text-xs font-mono text-gray-400">
          Target: <span className="text-gray-200">{activePlan?.domain || 'msn.com'}</span>
        </div>
      </div>

      {/* Side-by-Side Dual Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[400px]">
        {/* Left Pane: Terminal Logs Console (7 cols) */}
        <div className="lg:col-span-7 bg-[#0B0F19] border border-gray-800 rounded-lg p-4 font-mono text-xs flex flex-col justify-between overflow-hidden">
          <div className="flex items-center justify-between border-b border-gray-800/60 pb-2 mb-2">
            <span className="text-gray-400 text-[11px]">AGENT EXECUTION TERMINAL LOGS</span>
            <span className="text-emerald-400 text-[10px] flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>Connected</span>
            </span>
          </div>

          <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-2 pr-2 scrollbar-thin">
            {logs.length === 0 ? (
              <div className="text-gray-500 italic py-10 text-center">
                Waiting for scenario execution logs...
              </div>
            ) : (
              logs.map((log) => {
                let badgeColor = 'text-[#00F2FE] bg-[#00F2FE]/10 border-[#00F2FE]/30';
                if (log.level === 'warn') badgeColor = 'text-amber-400 bg-amber-400/10 border-amber-400/30';
                if (log.level === 'error') badgeColor = 'text-rose-400 bg-rose-400/10 border-rose-400/30';

                return (
                  <div key={log.id} className="leading-relaxed flex items-start space-x-2">
                    <span className="text-gray-500 text-[10px] pt-0.5 shrink-0">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border shrink-0 uppercase ${badgeColor}`}>
                      {log.agent}
                    </span>
                    <span className="text-gray-200 break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Pane: Live Browser Preview Window (5 cols) */}
        <div className="lg:col-span-5 bg-[#0D1515] border border-gray-800 rounded-lg flex flex-col overflow-hidden">
          {/* Browser Chrome Header */}
          <div className="bg-[#151D1E] px-3 py-2 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
            </div>

            {/* URL Bar */}
            <div className="flex-1 mx-3 bg-[#0B0F19] px-2.5 py-1 rounded text-[11px] font-mono text-gray-300 flex items-center space-x-1.5 border border-gray-800 truncate">
              <Globe className="w-3 h-3 text-[#00F2FE] shrink-0" />
              <span className="truncate">{targetUrl}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center space-x-1">
              <button 
                onClick={() => setIsPaused(!isPaused)}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
                title="Pause Browser Session"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
              <button 
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
                title="Stop Session"
              >
                <Square className="w-3.5 h-3.5" />
              </button>
              <button 
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800 transition-colors"
                title="Take Snapshot"
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Simulated DOM Canvas View */}
          <div className="flex-1 p-4 bg-[#05070A] relative flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#00F2FE]/10 border border-[#00F2FE]/30 flex items-center justify-center animate-pulse">
              <Globe className="w-8 h-8 text-[#00F2FE]" />
            </div>
            <div className="space-y-1">
              <h4 className="text-xs font-mono font-bold text-gray-200">
                Playwright Headless Chrome active
              </h4>
              <p className="text-[11px] text-gray-400 max-w-xs">
                MCP protocol listening to DOM mutation tree & accessibility nodes.
              </p>
            </div>

            <div className="absolute bottom-3 right-3 bg-[#1E1E2E] border border-gray-800 rounded px-2 py-1 text-[10px] font-mono text-emerald-400 flex items-center space-x-1">
              <ShieldCheck className="w-3 h-3" />
              <span>DOM Isolated Sandbox</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
