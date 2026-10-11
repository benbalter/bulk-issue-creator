import fs from 'fs';
import path from 'path';

export function initializeConfig(configPath: string): void {
  const files = ['template.md.mustache', 'data.csv'];

  console.log('Config Path: ', configPath);
  fs.mkdirSync(configPath, { recursive: true });

  for (const file of files) {
    const filePath = path.join(configPath, file);
    // Create only if missing, in one step: checking existsSync first leaves a
    // window where a file created in between would be overwritten.
    try {
      fs.writeFileSync(filePath, '', { flag: 'wx' });
      console.log(`Created ${filePath}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }
  }
}
