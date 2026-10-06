import fs from 'fs';
import path from 'path';

export function initializeConfig(configPath: string): void {
  const files = ['template.md.mustache', 'data.csv'];

  console.log('Config Path: ', configPath);
  fs.mkdirSync(configPath, { recursive: true });

  for (const file of files) {
    const filePath = path.join(configPath, file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, '');
      console.log(`Created ${filePath}`);
    }
  }
}
