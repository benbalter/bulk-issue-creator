#!/usr/bin/env node

import { BulkIssueCreator } from "./bulk-issue-creator.js";
import { Command } from "commander";
import fs from "fs";

const program = new Command();
program.name("bulk-issue-creator");
program.description(
  "Bulk opens batches of issues (or comments) across GitHub repositories based on a template and CSV of values.",
);
program.usage("[options]");

program
  .command("create", { isDefault: true })
  .description("Run the bulk issue creator to create issues or comments")
  .option("-w, --write <boolean>", "Write issues to GitHub (default: false)")
  .option("-c, --comment <boolean>", "Create comments instead of issues")
  .option("-t, --template-path <string>", "Path to the template file")
  .option("-d, --csv-path <string>", "Path to the CSV file")
  .option(
    "-g, --github-token <string>",
    "GitHub Token for authenticating with GitHub",
  )
  .action(() => {
    const options = program.opts();
    const bulkIssueCreator = new BulkIssueCreator(options);
    bulkIssueCreator.run();
  });

program
  .command("init")
  .description(
    "Initialize the Bulk Issue Creator config folder with template and data file",
  )
  .option(
    "-p, --path <string>",
    "Path at which to generate the config directory",
    "./config",
  )
  .action(() => {
    const options = program.opts();
    const path = options.path || "./config";
    const files = ["template.md.mustache", "data.csv"];
    console.log("Config Path: ", path);
    fs.existsSync(path) || fs.mkdirSync(path);
    for (const file of files) {
      if (!fs.existsSync(`${path}/${file}`)) {
        fs.writeFileSync(`${path}/${file}`, "");
        console.log(`Created ${path}/${file}`);
      }
    }
  });

program.parse();
