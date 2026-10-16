#!/usr/bin/env node

import { BulkIssueCreator } from './bulk-issue-creator.js';
import { initializeConfig } from './init.js';
import { Command } from 'commander';
import { setFailed } from '@actions/core';

const program = new Command();
program.name('bulk-issue-creator');
program.description(
  'Bulk opens batches of issues (or comments) across GitHub or GitLab repositories based on a template and CSV of values.',
);
program.usage('[options]');

program
  .command('create', { isDefault: true })
  .description('Run the bulk issue creator to create issues or comments')
  .option('-w, --write', 'Write issues to the forge (default: false)')
  .option('-c, --comment', 'Create comments instead of issues')
  .option('-t, --template-path <string>', 'Path to the template file')
  .option('-d, --csv-path <string>', 'Path to the CSV file')
  .option('-l, --liquid', 'Use Liquid template engine (default: false)')
  .option(
    '-g, --github-token <string>',
    'GitHub Token for authenticating with GitHub',
  )
  .option('-f, --forge <string>', 'github or gitlab (default: github)')
  .option(
    '--gitlab-token <string>',
    'GitLab token for authenticating with GitLab',
  )
  .option('--gitlab-url <string>', 'GitLab URL (default: https://gitlab.com)')
  .action(async (options) => {
    try {
      const bulkIssueCreator = new BulkIssueCreator(options);
      await bulkIssueCreator.run();
    } catch (error) {
      setFailed(error instanceof Error ? error.message : String(error));
    }
  });

program
  .command('init')
  .description(
    'Initialize the Bulk Issue Creator config folder with template and data file',
  )
  .option(
    '-p, --path <string>',
    'Path at which to generate the config directory',
    './config',
  )
  .action((options) => initializeConfig(options.path));

program.parseAsync();
