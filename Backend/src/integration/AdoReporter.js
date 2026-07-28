import AdoClient from './AdoClient.js';

/**
 * Maps completed agent runs back to Azure DevOps Test Case IDs,
 * creates a Test Run under the configured Plan/Suite, and publishes outcomes.
 * @param {Array<Object>} completedRuns - List of completed scenario runs
 */
export async function reportResultsToAdo(completedRuns) {
  const org = process.env.ADO_ORG;
  const project = process.env.ADO_PROJECT;
  const pat = process.env.ADO_PAT;
  const planId = process.env.ADO_PLAN_ID;
  const suiteId = process.env.ADO_SUITE_ID;

  if (!org || !project || !pat || !planId || !suiteId) {
    console.log('[ADO Reporter] Missing Azure DevOps configuration. Reporting skipped.');
    return;
  }

  // Filter runs that actually have an ADO Test Case ID
  const runsToReport = completedRuns.filter(run => run.id);
  if (runsToReport.length === 0) {
    console.log('[ADO Reporter] No runs with Azure DevOps Test Case ID found. Reporting skipped.');
    return;
  }

  console.log(`[ADO Reporter] Starting publishing of results for ${runsToReport.length} runs to ADO Test Suite ${suiteId}...`);

  try {
    const client = new AdoClient(org, project, pat);

    // 1. Fetch all Test Points for this Suite to map TestCaseID -> TestPointID
    const points = await client.fetchSuitePoints(planId, suiteId);
    
    // Create mapping: testCaseId -> testPoint (full object)
    const pointMap = new Map();
    for (const pt of points) {
      if (pt.testCase && pt.testCase.id) {
        pointMap.set(pt.testCase.id.toString(), pt);
      }
    }

    // Map completed runs to results payload
    const results = [];
    const pointIds = [];

    for (const run of runsToReport) {
      const caseIdStr = run.id.toString();
      if (pointMap.has(caseIdStr)) {
        const pt = pointMap.get(caseIdStr);
        const pointId = pt.id;
        pointIds.push(pointId);
        
        results.push({
          testPoint: { id: pointId.toString() },
          testCase: { id: caseIdStr },
          testCaseTitle: pt.testCase.name,
          testCaseRevision: 1, // Default revision required for planned test run results
          outcome: run.passed ? 'Passed' : 'Failed',
          state: 'Completed',
          comment: `AI Test Platform Execution Outcome: ${run.outcome}.\nDuration: ${(run.durationMs / 1000).toFixed(2)}s.\nPrompt: ${run.prompt}\n\nStdout:\n${run.stdout ? run.stdout.substring(0, 1000) : ''}\n\nStderr:\n${run.stderr ? run.stderr.substring(0, 1000) : ''}`,
          errorMessage: run.passed ? undefined : (run.stderr || run.outcome || 'Test failed')
        });
      } else {
        console.warn(`[ADO Reporter Warning] No Test Point found for Test Case ID ${caseIdStr} in suite.`);
      }
    }

    if (results.length === 0) {
      console.log('[ADO Reporter] No matching Test Points found in ADO suite. Reporting skipped.');
      return;
    }

    // 2. Create the Test Run
    let runId;
    try {
      const runName = `AI Agent Run - ${new Date().toLocaleString()}`;
      const testRun = await client.createTestRun(runName, planId, pointIds);
      runId = testRun.id;

      // 3. Publish the Test Results
      await client.publishTestResults(runId, results);

      // 4. Complete the Test Run
      await client.completeTestRun(runId);

      console.log(`[ADO Reporter] Successfully reported results to Azure DevOps. Run ID: ${runId}`);
    } catch (publishErr) {
      console.error('[ADO Reporter Error] Failed during ADO results publishing phase:', publishErr.message);
      if (runId) {
        console.log(`[ADO Reporter] Attempting to mark Test Run ${runId} as Completed/Closed after error...`);
        try {
          await client.completeTestRun(runId);
        } catch (completeErr) {
          console.error('[ADO Reporter Error] Failed to complete test run after publish failure:', completeErr.message);
        }
      }
      throw publishErr;
    }
  } catch (err) {
    console.error('[ADO Reporter Error] Failed to report results to Azure DevOps:', err.message);
  }
}
