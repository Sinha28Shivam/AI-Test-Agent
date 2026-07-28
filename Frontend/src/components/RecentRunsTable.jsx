import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Code, ExternalLink } from 'lucide-react';

export default function RecentRunsTable({ runs = [], onViewCode }) {
  const dummyRuns = [
    {
      id: 'run-9f82a1',
      domain: 'msn.com',
      scenarioType: 'Smoke_Testing',
      executionMode: 'explore',
      duration_ms: 14200,
      passed: true,
      push_decision: 'pushed',
      created_at: new Date().toISOString()
    },
    {
      id: 'run-4b19c2',
      domain: 'github.com',
      scenarioType: 'Regression_Testing',
      executionMode: 'replay',
      duration_ms: 6100,
      passed: true,
      push_decision: 'pushed',
      created_at: new Date(Date.now() - 3600000).toISOString()
    },
    {
      id: 'run-7d22e4',
      domain: 'example.com',
      scenarioType: 'Smoke_Testing',
      executionMode: 'explore',
      duration_ms: 18500,
      passed: false,
      push_decision: 'skipped',
      created_at: new Date(Date.now() - 7200000).toISOString()
    }
  ];

  const displayRuns = runs.length > 0 ? runs : dummyRuns;

  return (
    <div className="bg-[#1E1E2E] border border-gray-800 rounded-xl p-5 shadow-xl space-y-4">
      <div className="flex items-center justify-between border-b border-gray-800/80 pb-3">
        <div>
          <h3 className="font-bold text-white text-base">Recent Test Execution Runs</h3>
          <p className="text-xs text-gray-400 mt-0.5">Historical record of explore and replay test sessions</p>
        </div>
        <span className="text-xs font-mono text-gray-400">Total: {displayRuns.length} runs</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left font-sans text-xs">
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 font-mono uppercase text-[11px]">
              <th className="py-2.5 px-3">Run ID</th>
              <th className="py-2.5 px-3">Target Domain</th>
              <th className="py-2.5 px-3">Scenario Type</th>
              <th className="py-2.5 px-3">Mode</th>
              <th className="py-2.5 px-3">Duration</th>
              <th className="py-2.5 px-3">Outcome</th>
              <th className="py-2.5 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/60 font-mono">
            {displayRuns.map((run, i) => {
              const isPassed = run.passed;
              return (
                <tr key={i} className="hover:bg-[#151D1E]/80 transition-colors">
                  <td className="py-3 px-3 text-gray-300 font-semibold">{run.run_id || run.id}</td>
                  <td className="py-3 px-3 text-[#00F2FE]">{run.domain || 'msn.com'}</td>
                  <td className="py-3 px-3 text-gray-300">{run.scenario_type || run.scenarioType}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      run.execution_mode === 'replay' || run.executionMode === 'replay'
                        ? 'bg-purple-500/10 text-purple-400 border border-purple-500/30'
                        : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                    }`}>
                      {run.execution_mode || run.executionMode || 'explore'}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-gray-400">
                    {((run.duration_ms || 12000) / 1000).toFixed(1)}s
                  </td>
                  <td className="py-3 px-3">
                    {isPassed ? (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>PASSED</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/30">
                        <XCircle className="w-3 h-3" />
                        <span>FAILED</span>
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right">
                    <button 
                      onClick={() => onViewCode && onViewCode(run)}
                      className="inline-flex items-center space-x-1 text-[11px] text-[#00F2FE] hover:underline cursor-pointer"
                    >
                      <Code className="w-3.5 h-3.5" />
                      <span>Spec Code</span>
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
