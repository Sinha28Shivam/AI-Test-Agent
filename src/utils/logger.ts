export class Logger {
    static info(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [INFO] ${message}`);
    }

    static success(message: string): void {
        const timestamp = new Date().toISOString();
        console.log(`[${timestamp}] [SUCCESS] ✓ ${message}`);
    }

    static error(message: string): void {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] [ERROR] ✗ ${message}`);
    }

    static warn(message: string): void {
        const timestamp = new Date().toISOString();
        console.warn(`[${timestamp}] [WARN] ⚠ ${message}`);
    }
}

export const logger = Logger;