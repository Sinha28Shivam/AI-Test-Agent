import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { logger } from "../utils/logger";
import { AIConfig } from "../utils/ai-config";
import axios from "axios";

export interface GHAutoPushInput {
  testStatus: "passed" | "failed";
  passRate: number;
  testsPassed: number;
  testsTotal: number;
  testsFailed: number;
  validationScore: number;
  healingAttempts: number;
  durationSeconds: number;
  isFixable: boolean;
  rootCauses: string[];
  issueTypes: string[];
  originalPrompt: string;
  scriptPath: string;
}

export interface GHAutoPushResponse {
  shouldPush: boolean;
  confidence: "high" | "medium" | "low";
  reason: string;
  branch: string;
  commitMessage: string;
  openIssue?: boolean;
  issueTitle?: string;
  issueBody?: string;
}

function runCmd(command: string, cwd: string = process.cwd()): string {
  try {
    logger.info(`Running command: ${command}`);
    const stdout = execSync(command, { cwd, stdio: "pipe" });
    return stdout.toString().trim();
  } catch (error: any) {
    const stderr = error.stderr ? error.stderr.toString().trim() : error.message;
    logger.error(`Command failed: ${command}\nError: ${stderr}`);
    throw new Error(`Command failed: ${command}. Error: ${stderr}`);
  }
}

function getSlug(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, "") // strip URLs
    .replace(/[^a-z0-9\s-]/g, "")     // strip punctuation
    .trim()
    .replace(/\s+/g, "-")             // replace spaces with hyphens
    .substring(0, 50)                 // limit length
    .replace(/-+$/, "");              // clean trailing hyphens
}

function escapeForYamlDoubleQuotes(val: any): string {
  const str = String(val);
  return str
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

function populateTemplate(template: string, input: GHAutoPushInput): string {
  const slug = getSlug(input.originalPrompt);
  const replacements: Record<string, string> = {
    test_status: input.testStatus,
    pass_rate: String(input.passRate),
    tests_passed: String(input.testsPassed),
    tests_total: String(input.testsTotal),
    tests_failed: String(input.testsFailed),
    validation_score: String(input.validationScore),
    healing_attempts: String(input.healingAttempts),
    duration_seconds: String(input.durationSeconds),
    is_fixable: String(input.isFixable),
    root_causes: input.rootCauses.length > 0 ? input.rootCauses.join(", ") : "none",
    issue_types: input.issueTypes.length > 0 ? input.issueTypes.join(", ") : "none",
    original_prompt: input.originalPrompt,
    feature_slug: slug,
  };

  let populated = template;
  for (const [key, value] of Object.entries(replacements)) {
    const escapedValue = escapeForYamlDoubleQuotes(value);
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    populated = populated.replace(regex, escapedValue);
  }
  return populated;
}

function parseAIResponse(aiOutput: string): GHAutoPushResponse {
  try {
    const jsonMatch = aiOutput.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON object found in AI response");
    }
    const response: GHAutoPushResponse = JSON.parse(jsonMatch[0]);
    
    if (typeof response.shouldPush !== "boolean") {
      throw new Error("Missing or invalid 'shouldPush' field in decision JSON");
    }
    
    return response;
  } catch (error: any) {
    logger.error(`Error parsing AI decision JSON: ${error.message}`);
    throw error;
  }
}

async function isGhCliAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const { exec } = require("child_process");
    exec("gh --version", (err: any) => {
      resolve(!err);
    });
  });
}

function getRepoDetails(): { owner: string; repo: string } | null {
  try {
    const url = execSync("git remote get-url origin", { stdio: "pipe" }).toString().trim();
    const match = url.match(/(?:github\.com[:/])([^/]+)\/([^.]+)(?:\.git)?/);
    if (match && match[1] && match[2]) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, "")
      };
    }
  } catch (e) {
    logger.warn("Could not retrieve repository details from git remote");
  }
  return null;
}

async function createGitHubIssueApi(
  owner: string,
  repo: string,
  title: string,
  body: string,
  token: string
): Promise<void> {
  try {
    const response = await axios.post(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      { title, body },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28"
        }
      }
    );
    logger.success(`✓ GitHub Issue created successfully via API: ${response.data.html_url}`);
  } catch (error: any) {
    const message = error.response?.data?.message || error.message;
    logger.error(`Failed to create GitHub issue via API: ${message}`);
  }
}

async function openGitHubIssue(response: GHAutoPushResponse): Promise<void> {
  const title = response.issueTitle || "[Auto-Test Failed]";
  const body = response.issueBody || "No details provided.";

  logger.info(`Opening GitHub Issue: "${title}"...`);

  // Try using GitHub CLI first
  try {
    const isAvailable = await isGhCliAvailable();
    if (isAvailable) {
      logger.info("Using gh CLI to create issue...");
      const tempDir = path.join(process.cwd(), ".temp");
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const issueBodyPath = path.join(tempDir, "issue-body.md");
      fs.writeFileSync(issueBodyPath, body, "utf-8");

      try {
        runCmd(`gh issue create --title "${title}" --body-file "${issueBodyPath}"`);
        logger.success("✓ GitHub Issue created successfully via CLI");
        return;
      } finally {
        if (fs.existsSync(issueBodyPath)) {
          fs.unlinkSync(issueBodyPath);
        }
      }
    }
  } catch (cliError: any) {
    logger.warn(`Failed to create issue via CLI: ${cliError.message}`);
  }

  // Fallback to REST API if GITHUB_TOKEN is present and valid
  const token = process.env.GITHUB_TOKEN;
  if (token && token !== "ghp_YOUR_TOKEN_HERE") {
    logger.info("Attempting to create issue via GitHub REST API...");
    const repoDetails = getRepoDetails();
    if (repoDetails) {
      await createGitHubIssueApi(repoDetails.owner, repoDetails.repo, title, body, token);
      return;
    } else {
      logger.warn("Could not determine repository owner/name from remote URL");
    }
  } else {
    logger.warn("GitHub token is not configured or is the default placeholder. Skipping REST API issue creation.");
  }

  logger.warn("Could not open GitHub Issue. Please check that either 'gh' CLI is authenticated or a valid GITHUB_TOKEN is set in .env.");
}

function runGitOperations(response: GHAutoPushResponse, scriptPath: string): void {
  let originalBranch = "";
  try {
    logger.info("Initializing Git operations for auto push...");

    // Check if git is initialized
    try {
      execSync("git rev-parse --is-inside-work-tree", { stdio: "ignore" });
    } catch {
      logger.warn("Not a git repository. Initializing local git repository...");
      runCmd("git init");
    }

    try {
      originalBranch = execSync("git rev-parse --abbrev-ref HEAD", { stdio: "pipe" }).toString().trim();
      logger.info(`Detected current branch: ${originalBranch}`);
    } catch (e) {
      logger.warn("Could not determine original git branch");
    }

    const branchName = response.branch.trim();
    if (!branchName) {
      throw new Error("No branch name provided in AI decision");
    }

    // Switch/create branch
    logger.info(`Checking out branch: ${branchName}`);
    try {
      // Check if branch already exists locally
      const localBranches = execSync("git branch", { stdio: "pipe" }).toString();
      if (localBranches.includes(branchName)) {
        runCmd(`git checkout "${branchName}"`);
      } else {
        runCmd(`git checkout -b "${branchName}"`);
      }
    } catch (e) {
      // Fallback
      runCmd(`git checkout -b "${branchName}"`);
    }

    // Stage files
    let stagedCount = 0;
    if (scriptPath && fs.existsSync(scriptPath)) {
      runCmd(`git add -f "${scriptPath}"`);
      stagedCount++;
      logger.info(`Staged test script: ${scriptPath}`);
    } else {
      logger.warn(`Generated script not found at: ${scriptPath}`);
    }

    const reportPath = path.join("reports", "final", "report.json");
    if (fs.existsSync(reportPath)) {
      runCmd(`git add -f "${reportPath}"`);
      stagedCount++;
      logger.info(`Staged final report: ${reportPath}`);
    } else {
      logger.warn(`Final report not found at: ${reportPath}`);
    }

    if (stagedCount === 0) {
      logger.warn("No files were staged for commit.");
      return;
    }

    // Commit using temporary commit message file to handle newlines and escaping safely on all platforms
    const tempDir = path.join(process.cwd(), ".temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const commitMsgPath = path.join(tempDir, "commit-msg.txt");
    fs.writeFileSync(commitMsgPath, response.commitMessage, "utf-8");

    try {
      runCmd(`git commit -F "${commitMsgPath}"`);
      logger.success("✓ Committed changes successfully");
    } catch (commitError: any) {
      if (commitError.message && commitError.message.includes("nothing to commit")) {
        logger.info("No changes to commit (working tree clean).");
      } else {
        throw commitError;
      }
    } finally {
      if (fs.existsSync(commitMsgPath)) {
        fs.unlinkSync(commitMsgPath);
      }
    }

    // Push to remote if origin exists
    try {
      const remotes = execSync("git remote", { stdio: "pipe" }).toString().trim();
      if (remotes.includes("origin")) {
        logger.info(`Pushing to origin/${branchName}...`);
        runCmd(`git push -u origin "${branchName}"`);
        logger.success(`✓ Successfully pushed changes to origin/${branchName}`);
      } else {
        logger.warn("No 'origin' remote configured. Skipping push.");
      }
    } catch (pushError: any) {
      logger.error(`Failed to push to GitHub remote: ${pushError.message}`);
      logger.warn("Changes remain committed in local branch.");
    }
  } catch (error: any) {
    logger.error(`Git operations failed: ${error.message}`);
  } finally {
    try {
      if (originalBranch) {
        logger.info(`Returning to original branch: ${originalBranch}`);
        runCmd(`git checkout "${originalBranch}"`);
      }
    } catch (checkoutError: any) {
      logger.error(`Failed to switch back to original branch: ${checkoutError.message}`);
    }
  }
}

export class GHAutoPushAgent {
  /**
   * Run the GitHub Auto Push agent.
   * Evaluates the execution metrics against decision rules in yaml,
   * queries AI for a structured decision, and commits/pushes/opens issues.
   */
  static async run(input: GHAutoPushInput): Promise<GHAutoPushResponse | null> {
    logger.info("\n" + "=".repeat(60));
    logger.info("RUNNING GITHUB AUTO PUSH AGENT");
    logger.info("=".repeat(60));

    try {
      const yamlPath = path.join(__dirname, "gh-auto-push.yaml");
      if (!fs.existsSync(yamlPath)) {
        logger.error(`✗ YAML template not found at ${yamlPath}`);
        return null;
      }

      logger.info(`Loading push agent config from ${yamlPath}...`);
      const template = fs.readFileSync(yamlPath, "utf-8");

      // Replace placeholders to construct the prompt
      const populatedPrompt = populateTemplate(template, input);

      logger.info("Calling AI analyzer provider for push decision...");
      const provider = AIConfig.getAnalyzerProvider();
      const response = await provider.generate(populatedPrompt);

      if (!response.success || !response.data) {
        logger.error(`✗ Push decision agent failed: ${response.error}`);
        return null;
      }

      const decision = parseAIResponse(response.data);

      logger.info("\n" + "-".repeat(50));
      logger.info("DECISION SUMMARY:");
      logger.info(`  • Should Push: ${decision.shouldPush}`);
      logger.info(`  • Confidence:  ${decision.confidence}`);
      logger.info(`  • Reason:      ${decision.reason}`);
      if (decision.shouldPush) {
        logger.info(`  • Branch:      ${decision.branch}`);
      }
      if (decision.openIssue) {
        logger.info(`  • Open Issue:  ${decision.openIssue}`);
        logger.info(`  • Issue Title: ${decision.issueTitle}`);
      }
      logger.info("-".repeat(50) + "\n");

      if (decision.shouldPush) {
        runGitOperations(decision, input.scriptPath);
      } else {
        logger.info("Push skipped based on agent decision.");
        if (decision.openIssue) {
          await openGitHubIssue(decision);
        }
      }

      return decision;
    } catch (error: any) {
      logger.error(`✗ GitHub Auto Push agent execution failed: ${error.message}`);
      return null;
    }
  }
}
