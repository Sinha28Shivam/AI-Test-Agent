import React from 'react';
import { LayoutDashboard, PlayCircle, Terminal, Code2, Globe, Settings, ShieldCheck } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'launcher', label: 'Test Launcher', icon: PlayCircle },
    { id: 'monitor', label: 'Live Execution', icon: Terminal },
    { id: 'repository', label: 'Spec Repository', icon: Code2 },
    { id: 'domains', label: 'Domain Profiles', icon: Globe },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 border-r border-gray-800 bg-[#0D1515] flex flex-col justify-between p-4 shrink-0">
      <div className="space-y-6">
        <div className="px-3 text-[11px] font-mono font-semibold text-gray-500 uppercase tracking-wider">
          Navigation
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-[#1E1E2E] text-white border-l-2 border-[#00F2FE] shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#151D1E]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#00F2FE]' : 'text-gray-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Enterprise Security Badge Footer */}
      <div className="bg-[#151D1E] border border-gray-800/80 rounded-lg p-3 space-y-2">
        <div className="flex items-center space-x-2 text-emerald-400 font-mono text-xs">
          <ShieldCheck className="w-4 h-4" />
          <span className="font-semibold">Enterprise Ready</span>
        </div>
        <p className="text-[11px] text-gray-400 leading-tight">
          Secret masking enabled. MCP Sandbox Active.
        </p>
      </div>
    </aside>
  );
}
