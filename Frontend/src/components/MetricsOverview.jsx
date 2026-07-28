import React from 'react';
import { Layers, CheckCircle2, Clock, Zap, ArrowUpRight } from 'lucide-react';

export default function MetricsOverview({ stats }) {
  const cards = [
    {
      title: 'Total Scenarios Executed',
      value: stats?.totalRuns || 128,
      change: '+18% this week',
      icon: Layers,
      color: 'text-[#00F2FE]',
      bg: 'bg-[#00F2FE]/10'
    },
    {
      title: 'Overall Success Rate',
      value: stats?.successRate || '94.2%',
      change: 'Auto-healing active',
      icon: CheckCircle2,
      color: 'text-emerald-400',
      bg: 'bg-emerald-400/10'
    },
    {
      title: 'Avg Exploration Duration',
      value: stats?.avgDuration || '14.2s',
      change: '-2.4s replay acceleration',
      icon: Clock,
      color: 'text-purple-400',
      bg: 'bg-purple-400/10'
    },
    {
      title: 'API Token Overhead Saved',
      value: stats?.tokenSavings || '95%',
      change: 'Replay mode active',
      icon: Zap,
      color: 'text-amber-400',
      bg: 'bg-amber-400/10'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} className="bg-[#1E1E2E] border border-gray-800 rounded-xl p-5 shadow-lg space-y-3 relative overflow-hidden group hover:border-[#00F2FE]/50 transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{card.title}</span>
              <div className={`p-2 rounded-lg ${card.bg}`}>
                <Icon className={`w-4 h-4 ${card.color}`} />
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl font-bold font-mono text-white tracking-tight">{card.value}</div>
              <div className="text-[11px] text-gray-400 flex items-center space-x-1">
                <span>{card.change}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
