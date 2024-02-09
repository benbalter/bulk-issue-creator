#!/usr/bin/env node

import { BulkIssueCreator } from "./bulk-issue-creator.js";
import { Command } from "commander";

const program = new Command();
program.name("bulk-issue-creator");
program.description(
  "Create multiple issues (or comments) on GitHub from a CSV file",
);
program.usage("[options]");

program
  .option("-w", "--write <boolean>", "Actually, really, write issues to GitHub")
  .option(
    "-c",
    "--comment <boolean>",
    "Comment on an issue instead of creating one",
  )
  .option("-t", "--template-path <string>", "Path to the issue template")
  .option("-d", "--csv-path <string>", "Path to the CSV file")
  .option("-g", "--github-token <string>", "GitHub token");

const options = program.opts();
const bulkIssueCreator = new BulkIssueCreator(options);
bulkIssueCreator.run();
