import * as fs from "fs";
import * as core from "@actions/core";
import * as github from "@actions/github";
import { parse } from "csv-parse/sync";
import { Issue } from "./issue.js";
import * as yaml from "js-yaml";
import { RequestError } from "@octokit/request-error";
import { GitHub } from "@actions/github/lib/utils.js";
import camelCase from "camelcase";
import fetchMock from "fetch-mock";

export const sandbox = fetchMock.sandbox();

interface Options {
  templatePath?: string;
  csvPath?: string;
  write?: boolean;
  comment?: boolean;
  githubToken?: string;
  liquid?: boolean;
}

export class BulkIssueCreator {
  optionKeys = [
    "template_path",
    "csv_path",
    "write",
    "comment",
    "github_token",
    "liquid",
  ];
  boolOptions = ["write", "comment", "liquid"];
  defaultTemplatePath = "./config/template.md.mustache";
  defaultCsvPath = "./config/data.csv";
  _octokit: InstanceType<typeof GitHub> | undefined;
  options = {
    templatePath: this.defaultTemplatePath,
    csvPath: this.defaultCsvPath,
    write: false,
    comment: false,
    githubToken: null,
    liquid: false,
  };

  // Assign options in the following order:
  // 1. Passed options
  // 2. Inputs from the workflow
  // 3. Environment variables
  constructor(passedOptions: Options = {}) {
    for (const key of this.optionKeys) {
      const camelCaseKey = camelCase(key);
      const value =
        passedOptions[camelCaseKey] ||
        core.getInput(key.toUpperCase()) ||
        process.env[key.toUpperCase()] ||
        null;
      this.options[camelCaseKey] = this.boolOptions.includes(key)
        ? this.truthy(value)
        : value;
    }
  }

  get octokit() {
    if (this._octokit === undefined) {
      let options = {};
      if (process.env.NODE_ENV === "test") {
        options = { request: { fetch: sandbox } };
      }
      this._octokit = github.getOctokit(this.options.githubToken, options);
    }

    return this._octokit;
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
      const issue = new Issue(row, this.template, this.options.liquid);
      issues.push(issue);
    }
    return issues;
  }

  private get sanitizedOptions() {
    return {
      templatePath: this.templatePath,
      csvPath: this.csvPath,
      write: this.write,
      comment: this.comment,
      liquid: this.options.liquid,
    };
  }

  async run() {
    core.info(`Running with options:\n${yaml.dump(this.sanitizedOptions)}`);

    this.ensurePathExists(this.templatePath);
    this.ensurePathExists(this.csvPath);

    if (this.readonly) {
      await this.previewOutput();
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
        core.warning("Issue title not found: ", issue.data);
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
    core.info(`Created issue ${response.data.html_url}`);
  }

  private async createComments() {
    let response;

    for (const issue of this.issues) {
      if (!issue.number) {
        core.warning("Issue number not found: ", issue.data);
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

  private async repoExists(nwo: string) {
    const [owner, repo] = nwo.split("/");
    try {
      await this.octokit.rest.repos.get({
        owner,
        repo,
      });
    } catch (error) {
      if (error instanceof RequestError && error.status === 404) {
        core.warning(`Repository ${nwo} does not exist. Skipping...`);
        return false;
      } else if (error instanceof RequestError && error.status === 401) {
        core.warning(`Unauthorized access to repository ${nwo}. Skipping...`);
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

  private async previewOutput() {
    core.info("Running in READ ONLY mode. Pass `write` variable to write.");
    if (this.options.githubToken === null) {
      core.info(
        "Note: No GitHub token provided. Skipping repository existence check.",
      );
    }

    core.info(
      `The following ${this.comment ? "comments" : "issues"} would have been created:\n`,
    );

    for (const issue of this.issues) {
      core.info(yaml.dump(issue.data));
      if (this.options.githubToken !== null) {
        await this.repoExists(issue.repository);
      }
    }
  }
}
