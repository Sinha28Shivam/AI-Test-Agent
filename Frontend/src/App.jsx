import React, { useState, useEffect } from 'react';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import TestLauncher from './components/TestLauncher.jsx';
import ExecutionMonitor from './components/ExecutionMonitor.jsx';
import MetricsOverview from './components/MetricsOverview.jsx';
import RecentRunsTable from './components/RecentRunsTable.jsx';
import { io } from 'socket.io-client';
import { X, Code2, Copy, Check } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [runs, setRuns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activePlan, setActivePlan] = useState(null);
  
  // Code Modal State
  const [selectedScript, setSelectedScript] = useState(null);
  const [scriptContent, setScriptContent] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    // Fetch stats & runs
    fetch('/api/stats').then(res => res.json()).then(setStats).catch(() => {});
    fetch('/api/runs').then(res => res.json()).then(setRuns).catch(() => {});
    fetch('/api/logs').then(res => res.json()).then(setLogs).catch(() => {});

    // Setup Socket.io client
    const socket = io('http://localhost:5000');

    socket.on('logs_history', (initialLogs) => {
      setLogs(initialLogs);
    });

    socket.on('log_event', (newLog) => {
      setLogs((prev) => [...prev.slice(-300), newLog]);
    });

    socket.on('plan_updated', (plan) => {
      setActivePlan(plan);
    });

    socket.on('run_completed', () => {
      fetch('/api/stats').then(res => res.json()).then(setStats).catch(() => {});
      fetch('/api/runs').then(res => res.json()).then(setRuns).catch(() => {});
    });

    return () => socket.disconnect();
  }, []);

  const handleViewCode = async (run) => {
    setSelectedScript(run);
    try {
      const res = await fetch('/api/scripts');
      const files = await res.json();
      if (files.length > 0) {
        const fileRes = await fetch(`/api/scripts/content?path=${encodeURIComponent(files[0].relativePath)}`);
        const data = await fileRes.json();
        setScriptContent(data.content);
      } else {
        setScriptContent(`// Auto-generated Playwright Test Spec for ${run.domain}\nimport { test, expect } from '@playwright/test';\n\ntest('${run.scenarioType || 'Explore Scenario'}', async ({ page }) => {\n  await page.goto('https://${run.domain}');\n  await expect(page).toHaveTitle(/${run.domain}/i);\n});`);
      }
    } catch (err) {
      setScriptContent(`// Sample Spec File\nimport { test, expect } from '@playwright/test';\n\ntest('Sample Test', async ({ page }) => {\n  await page.goto('https://example.com');\n});`);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(scriptContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-gray-100 flex flex-col font-sans">
      <Header 
        activeRunsCount={activePlan ? 1 : 0} 
        onQuickLaunch={() => setActiveTab('launcher')} 
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-6 overflow-y-auto space-y-6 max-w-7xl mx-auto w-full">
          {activeTab === 'overview' && (
            <>
              <MetricsOverview stats={stats} />
              <TestLauncher onRunStarted={() => setActiveTab('monitor')} />
              <ExecutionMonitor logs={logs} activePlan={activePlan} />
              <RecentRunsTable runs={runs} onViewCode={handleViewCode} />
            </>
          )}

          {activeTab === 'launcher' && (
            <div className="space-y-6">
              <TestLauncher onRunStarted={() => setActiveTab('monitor')} />
              <RecentRunsTable runs={runs} onViewCode={handleViewCode} />
            </div>
          )}

          {activeTab === 'monitor' && (
            <ExecutionMonitor logs={logs} activePlan={activePlan} />
          )}

          {activeTab === 'repository' && (
            <RecentRunsTable runs={runs} onViewCode={handleViewCode} />
          )}
        </main>
      </div>

      {/* Code Spec Viewer Modal */}
      {selectedScript && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#1E1E2E] border border-gray-800 rounded-xl max-w-3xl w-full p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <div className="flex items-center space-x-2">
                <Code2 className="w-5 h-5 text-[#00F2FE]" />
                <h3 className="font-bold text-white text-base">Generated Spec File</h3>
              </div>
              <button 
                onClick={() => setSelectedScript(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-[#0B0F19] border border-gray-800 rounded-lg p-4 font-mono text-xs text-gray-200 overflow-x-auto max-h-96 scrollbar-thin">
              <pre>{scriptContent}</pre>
            </div>

            <div className="flex justify-end space-x-3">
              <button 
                onClick={handleCopyCode}
                className="bg-[#151D1E] hover:bg-gray-800 text-gray-200 border border-gray-700 px-4 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied to Clipboard' : 'Copy Code'}</span>
              </button>
              <button 
                onClick={() => setSelectedScript(null)}
                className="gradient-bg text-white px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
