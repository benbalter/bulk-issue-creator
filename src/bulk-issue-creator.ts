import * as fs from "fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { parse } from "csv-parse/sync";
import { Issue } from "./issue";
import * as yaml from "js-yaml";
import { RequestError } from "@octokit/request-error";
import { GitHub } from "@actions/github/lib/utils";
import camelCase from "camelcase";

interface Options {
  template_path?: string;
  csv_path?: string;
  write?: boolean;
  comment?: boolean;
  github_token?: string;
}

export class BulkIssueCreator {
  optionKeys = [
    "template_path",
    "csv_path",
    "write",
    "comment",
    "github_token",
  ];
  boolOptions = ["write", "comment"];
  defaultTemplatePath = "./config/template.md.mustache";
  defaultCsvPath = "./config/data.csv";
  octokit: InstanceType<typeof GitHub>;
  options = {
    templatePath: this.defaultTemplatePath,
    csvPath: this.defaultCsvPath,
    write: false,
    comment: false,
    githubToken: null,
  };

  constructor(passedOptions: Options = {}) {
    for (const key of this.optionKeys) {
      const value =
        passedOptions[key] || core.getInput(key.toUpperCase()) || null;
      const camelCaseKey = camelCase(key);
      this.options[camelCaseKey] = this.boolOptions.includes(key)
        ? this.truthy(value)
        : value;
    }

    const token = core.getInput("token", { required: true });
    this.octokit = github.getOctokit(token);
  }

  get templatePath() {
    return this.options.templatePath || this.defaultTemplatePath;
  }

  get csvPath() {
    return this.options.csvPath || this.defaultCsvPath;
  }

  get readonly() {
    return this.options.write !== true;
  }

  get write() {
    return !this.readonly;
  }

  get comment() {
    return this.options.comment === true;
  }

  get template() {
    return fs.readFileSync(this.templatePath, "utf8");
  }

  get issues() {
    const issues: Issue[] = [];
    const data = this.data;
    for (const row of data) {
      const issue = new Issue(row, this.template);
      issues.push(issue);
    }
    return issues;
  }

  async run() {
    core.info(`Running with options: ${yaml.dump(this.options)}`);

    this.ensurePathExists(this.templatePath);
    this.ensurePathExists(this.csvPath);

    if (this.readonly) {
      this.previewOutput();
      return;
    }

    if (this.comment) {
      await this.createComments();
    } else {
      await this.createIssues();
    }
  }

  private async createIssues() {
    let response;
    for (const issue of this.issues) {
      if (!issue.title) {
        core.warning(
          "Issue title not found: ", issue.data,
        );
        continue;
      }
      
      response = await this.octokit.rest.issues.create({
        owner: issue.nwo[0],
        repo: issue.nwo[1],
        title: issue.title,
        body: issue.body,
        labels: issue.labels,
        assignees: issue.assignees,
      });
    }
    core.info(`Created issue ${response.html_url}`);
  }

  private async createComments() {
    let response;

    for (const issue of this.issues) {
      if (!issue.number) {
        core.warning(
          "Issue number not found: ", issue.data,
        );
        continue;
      }

      response = await this.octokit.rest.issues.createComment({
        owner: issue.nwo[0],
        repo: issue.nwo[1],
        issue_number: issue.number,
        body: issue.body,
      });
      core.info(`Created comment ${response.html_url}`);
    }
  }

  private get data() {
    const csv = fs.readFileSync(this.csvPath, "utf8");
    return parse(csv, { columns: true });
  }

  private ensurePathExists(path: string) {
    if (!fs.existsSync(path)) {
      throw new Error(`Path does not exist: ${path}`);
    }
  }

  private repoExists(nwo: string) {
    const [owner, repo] = nwo.split("/");
    try {
      this.octokit.rest.repos.get({
        owner,
        repo,
      });
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        core.warning(`Repository ${nwo} does not exist. Skipping...`);
        return false;
      } else {
        throw error;
      }
    }

    return true;
  }

  private truthy(value: string | boolean) {
    return value === true || value === "true";
  }

  private previewOutput() {
    core.info(
      "Running in READ ONLY mode. Pass `WRITE=true` environmental variable to write.",
    );
    core.info(
      `the following ${this.comment ? "comments" : "issues"} would have been created:`,
    );

    for (const issue of this.issues) {
      this.repoExists(issue.repository);
      core.info(yaml.dump(issue.data));
    }
  }
}
