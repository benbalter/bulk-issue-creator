import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { initializeConfig } from './init.js';

describe('initializeConfig', () => {
  let temporaryDirectory: string;

  beforeEach(() => {
    temporaryDirectory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'bulk-issue-creator-'),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  });

  it('creates nested config directories and preserves existing files', () => {
    const configPath = path.join(temporaryDirectory, 'a', 'b', 'config');
    const templatePath = path.join(configPath, 'template.md.mustache');
    const dataPath = path.join(configPath, 'data.csv');

    initializeConfig(configPath);

    expect(fs.readFileSync(templatePath, 'utf8')).toBe('');
    expect(fs.readFileSync(dataPath, 'utf8')).toBe('');

    fs.writeFileSync(templatePath, 'custom template');
    fs.writeFileSync(dataPath, 'custom data');
    initializeConfig(configPath);

    expect(fs.readFileSync(templatePath, 'utf8')).toBe('custom template');
    expect(fs.readFileSync(dataPath, 'utf8')).toBe('custom data');
  });
});
