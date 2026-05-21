import fs from 'fs';
import path from 'path';

export class FileManager {
    static write(filePath: string, content: string): void {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
    }

    static read(filePath: string): string {
        return fs.readFileSync(filePath, 'utf-8');
    }

    static exists(filePath: string): boolean {
        return fs.existsSync(filePath);
    }
}