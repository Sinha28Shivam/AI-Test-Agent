import { ScenarioAgent } from "./src/agents/scenario-agent";

// Test the scenario parsing with the provided prompt
const prompt = 'Verify page loads and is visible at https://www.example.com';
const result = ScenarioAgent.parse(prompt);

console.log("=== SCENARIO PARSING TEST ===");
console.log(`Input: "${prompt}"`);
console.log("\nParsed Result:");
console.log(JSON.stringify(result, null, 2));

// Verify expected output
const checks = {
  "URL extracted correctly": result.url === "https://www.example.com",
  "page-load scenario detected": result.scenarios.includes("page-load"),
  "visibility-check scenario detected": result.scenarios.includes("visibility-check"),
  "Total scenarios: 2": result.scenarios.length === 2,
};

console.log("\n=== VERIFICATION CHECKS ===");
Object.entries(checks).forEach(([check, passed]) => {
  console.log(`${passed ? "✓" : "✗"} ${check}`);
});

const allPassed = Object.values(checks).every(v => v === true);
console.log(`\nResult: ${allPassed ? "✓ ALL CHECKS PASSED" : "✗ SOME CHECKS FAILED"}`);
