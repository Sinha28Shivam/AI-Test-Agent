#!/usr/bin/env node

/**
 * E2E Integration Test Verification
 * Tests all phases of the AI-Test-Agent pipeline
 */

import fs from 'fs';
import path from 'path';

interface VerificationResult {
  name: string;
  passed: boolean;
  details: string;
  errors?: string[];
}

const results: VerificationResult[] = [];

function verify(name: string, test: () => { passed: boolean; details: string; errors?: string[] }): void {
  try {
    const result = test();
    results.push({
      name,
      ...result
    });
    console.log(`${result.passed ? '✓' : '✗'} ${name}`);
    if (result.details) {
      console.log(`  ${result.details}`);
    }
    if (result.errors && result.errors.length > 0) {
      result.errors.forEach(error => console.log(`  ✗ ${error}`));
    }
  } catch (error) {
    results.push({
      name,
      passed: false,
      details: `Exception: ${error}`,
      errors: [String(error)]
    });
    console.log(`✗ ${name} - Exception: ${error}`);
  }
}

console.log('='.repeat(70));
console.log('E2E INTEGRATION TEST VERIFICATION');
console.log('='.repeat(70));
console.log();

// Test 1: Report files exist
console.log('Phase 1: OUTPUT FILES');
console.log('-'.repeat(70));

verify('Raw results file exists', () => {
  const filePath = path.join(process.cwd(), 'reports', 'raw', 'result.json');
  const exists = fs.existsSync(filePath);
  return {
    passed: exists,
    details: exists ? `Found: ${filePath}` : `Missing: ${filePath}`
  };
});

verify('Final report file exists', () => {
  const filePath = path.join(process.cwd(), 'reports', 'final', 'report.json');
  const exists = fs.existsSync(filePath);
  return {
    passed: exists,
    details: exists ? `Found: ${filePath}` : `Missing: ${filePath}`
  };
});

console.log();

// Test 2: Report JSON validity
console.log('Phase 2: JSON VALIDITY');
console.log('-'.repeat(70));

let reportData: any = null;
verify('Final report is valid JSON', () => {
  const filePath = path.join(process.cwd(), 'reports', 'final', 'report.json');
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    reportData = JSON.parse(content);
    return {
      passed: true,
      details: `Valid JSON (${content.length} bytes)`
    };
  } catch (error) {
    return {
      passed: false,
      details: `Invalid JSON: ${error}`,
      errors: [String(error)]
    };
  }
});

let rawData: any = null;
verify('Raw results are valid JSON', () => {
  const filePath = path.join(process.cwd(), 'reports', 'raw', 'result.json');
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    rawData = JSON.parse(content);
    return {
      passed: true,
      details: `Valid JSON (${content.length} bytes)`
    };
  } catch (error) {
    return {
      passed: false,
      details: `Invalid JSON: ${error}`,
      errors: [String(error)]
    };
  }
});

console.log();

// Test 3: Report structure
console.log('Phase 3: REPORT STRUCTURE');
console.log('-'.repeat(70));

verify('Report has status field', () => {
  const hasField = reportData && 'status' in reportData;
  return {
    passed: hasField,
    details: hasField ? `status: "${reportData.status}"` : 'Missing status field'
  };
});

verify('Report has pipelineStatus field', () => {
  const hasField = reportData && 'pipelineStatus' in reportData;
  return {
    passed: hasField,
    details: hasField ? `pipelineStatus: "${reportData.pipelineStatus}"` : 'Missing pipelineStatus field'
  };
});

verify('Report has summary section', () => {
  const hasSummary = reportData && 'summary' in reportData;
  const hasMetrics = hasSummary && 
    'totalTests' in reportData.summary &&
    'passed' in reportData.summary &&
    'failed' in reportData.summary &&
    'passRate' in reportData.summary;
  
  return {
    passed: hasMetrics,
    details: hasMetrics ? `Found all metrics` : 'Missing summary metrics',
    errors: hasMetrics ? undefined : ['Missing: totalTests, passed, failed, or passRate']
  };
});

verify('Report has analysis section', () => {
  const hasAnalysis = reportData && 'analysis' in reportData;
  const hasRequired = hasAnalysis &&
    'rootCauses' in reportData.analysis &&
    'issues' in reportData.analysis &&
    'recommendations' in reportData.analysis;
  
  return {
    passed: hasRequired,
    details: hasRequired ? `Analysis complete` : 'Missing analysis data',
    errors: hasRequired ? undefined : ['Missing: rootCauses, issues, or recommendations']
  };
});

verify('Report has nextActions array', () => {
  const hasArray = reportData && Array.isArray(reportData.nextActions);
  return {
    passed: hasArray && reportData.nextActions.length > 0,
    details: hasArray ? `${reportData.nextActions.length} action(s) provided` : 'Missing or empty nextActions'
  };
});

verify('Report has reportGeneratedAt timestamp', () => {
  const hasTimestamp = reportData && 'reportGeneratedAt' in reportData;
  const isValid = hasTimestamp && new Date(reportData.reportGeneratedAt).getTime() > 0;
  return {
    passed: isValid,
    details: isValid ? `Timestamp: ${reportData.reportGeneratedAt}` : 'Invalid or missing timestamp'
  };
});

console.log();

// Test 4: Metrics validation
console.log('Phase 4: METRICS VALIDATION');
console.log('-'.repeat(70));

verify('Metrics are consistent', () => {
  const s = reportData.summary;
  const total = s.totalTests;
  const accounted = s.passed + s.failed + (s.skipped || 0);
  const consistent = total === accounted;
  
  const errors = [];
  if (!consistent) {
    errors.push(`Total (${total}) !== Passed (${s.passed}) + Failed (${s.failed}) + Skipped (${s.skipped || 0})`);
  }
  
  return {
    passed: consistent,
    details: `Total: ${total}, Passed: ${s.passed}, Failed: ${s.failed}, Skipped: ${s.skipped || 0}`,
    errors: errors.length > 0 ? errors : undefined
  };
});

verify('Pass rate is calculated correctly', () => {
  const s = reportData.summary;
  const expectedPassRate = s.totalTests > 0 ? Math.round((s.passed / s.totalTests) * 100) : 0;
  const correct = s.passRate === expectedPassRate;
  
  return {
    passed: correct,
    details: `Pass Rate: ${s.passRate}% (expected: ${expectedPassRate}%)`,
    errors: correct ? undefined : [`Calculated: ${expectedPassRate}%, Reported: ${s.passRate}%`]
  };
});

verify('Duration is a positive number', () => {
  const duration = reportData.summary.duration;
  const valid = typeof duration === 'number' && duration > 0;
  return {
    passed: valid,
    details: valid ? `Duration: ${duration}ms (${(duration/1000).toFixed(2)}s)` : `Invalid duration: ${duration}`,
    errors: valid ? undefined : ['Duration must be a positive number']
  };
});

console.log();

// Test 5: Raw data validation
console.log('Phase 5: RAW RESULTS VALIDATION');
console.log('-'.repeat(70));

verify('Raw results has test list', () => {
  const hasTests = rawData && 'tests' in rawData && Array.isArray(rawData.tests);
  return {
    passed: hasTests,
    details: hasTests ? `${rawData.tests.length} test(s) recorded` : 'Missing tests array'
  };
});

verify('All tests have required fields', () => {
  if (!rawData || !rawData.tests) {
    return {
      passed: false,
      details: 'No tests array found'
    };
  }
  
  const errors: string[] = [];
  rawData.tests.forEach((test: any, idx: number) => {
    if (!test.title) errors.push(`Test ${idx}: missing title`);
    if (!test.status) errors.push(`Test ${idx}: missing status`);
    if (typeof test.duration !== 'number') errors.push(`Test ${idx}: invalid duration`);
  });
  
  return {
    passed: errors.length === 0,
    details: `${rawData.tests.length} test(s) valid`,
    errors: errors.length > 0 ? errors : undefined
  };
});

console.log();

// Test 6: Status consistency
console.log('Phase 6: STATUS CONSISTENCY');
console.log('-'.repeat(70));

verify('Pipeline status is "success" or "failed"', () => {
  const status = reportData.pipelineStatus;
  const valid = status === 'success' || status === 'failed';
  return {
    passed: valid,
    details: `Pipeline Status: ${status}`,
    errors: valid ? undefined : ['Must be "success" or "failed"']
  };
});

verify('Report status matches results', () => {
  const status = reportData.status;
  const hasFailed = reportData.summary.failed > 0;
  const correct = (status === 'passed' && !hasFailed) || (status === 'failed' && hasFailed);
  
  return {
    passed: correct,
    details: `Status: ${status} (${reportData.summary.failed} failed test(s))`,
    errors: correct ? undefined : ['Status does not match test results']
  };
});

verify('Failed=0 indicates pipeline success', () => {
  const failed = reportData.summary.failed;
  const isSuccess = reportData.status === 'passed' && reportData.pipelineStatus === 'success';
  const correct = failed === 0 && isSuccess;
  
  return {
    passed: correct,
    details: `Test Status: ${reportData.status}, Pipeline: ${reportData.pipelineStatus}`,
    errors: correct ? undefined : []
  };
});

console.log();

// Test 7: Next actions
console.log('Phase 7: NEXT ACTIONS');
console.log('-'.repeat(70));

verify('Next actions are populated', () => {
  const actions = reportData.nextActions;
  const populated = Array.isArray(actions) && actions.length > 0;
  
  return {
    passed: populated,
    details: `${actions?.length || 0} action(s) provided`,
    errors: populated ? undefined : ['nextActions must be a non-empty array']
  };
});

verify('Next actions contain expected content', () => {
  const actions = reportData.nextActions;
  const hasMeaning = actions && actions.some((a: string) => a.length > 0);
  
  return {
    passed: hasMeaning,
    details: `Actions: ${actions.slice(0, 2).join('; ')}${actions.length > 2 ? '...' : ''}`,
    errors: hasMeaning ? undefined : ['Actions contain empty strings']
  };
});

console.log();

// Summary
console.log('='.repeat(70));
console.log('VERIFICATION SUMMARY');
console.log('='.repeat(70));

const passed = results.filter(r => r.passed).length;
const failed = results.filter(r => !r.passed).length;
const total = results.length;

console.log(`✓ Passed: ${passed}/${total}`);
console.log(`✗ Failed: ${failed}/${total}`);
console.log(`Success Rate: ${Math.round((passed / total) * 100)}%`);

if (failed > 0) {
  console.log('\n' + '!'.repeat(70));
  console.log('FAILED CHECKS');
  console.log('!'.repeat(70));
  results.filter(r => !r.passed).forEach(r => {
    console.log(`\n✗ ${r.name}`);
    console.log(`  ${r.details}`);
    if (r.errors) {
      r.errors.forEach(e => console.log(`  - ${e}`));
    }
  });
}

console.log();
console.log('='.repeat(70));
if (failed === 0) {
  console.log('✓ ALL VERIFICATION CHECKS PASSED');
  console.log('✓ PRODUCTION READY');
} else {
  console.log(`✗ ${failed} CHECK(S) FAILED - REVIEW REQUIRED`);
}
console.log('='.repeat(70));

process.exit(failed === 0 ? 0 : 1);
