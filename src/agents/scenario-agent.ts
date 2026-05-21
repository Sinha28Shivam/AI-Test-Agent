import { logger } from "../utils/logger";

type scenarioResult = {
    url: string;
    scenarios: string[];
};

export class ScenarioAgent {
    static parse(prompt: string): scenarioResult {
        logger.info("Scenario Agent is running...");
        
        const urlMatch = prompt.match(/https?:\/\/[^\s]+/);
        const url = urlMatch ? urlMatch[0] : "";
        
        const scenarios: string[] = [];

        const lowerPrompt = prompt.toLocaleLowerCase();

        if(lowerPrompt.includes("login")){
            scenarios.push("Login");
        }

        if(lowerPrompt.includes("signup")){
            scenarios.push("Signup");
        }

        if(lowerPrompt.includes("logout")){
            scenarios.push("Logout");
        }
        if(lowerPrompt.includes("forgot password")){
            scenarios.push("Forgot Password");
        }

        if (scenarios.length === 0) {
            scenarios.push("Generic-test");
        }

        logger.success("Scenario parsing completed");

        return {
            url,
            scenarios
        };
    }
}