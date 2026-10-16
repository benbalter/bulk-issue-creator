import * as fs from 'fs';
import { getInput, warning, info, setFailed } from '@actions/core';
import { parse } from 'csv-parse/sync';
import { Issue, type IssueData } from './issue.js';
import * as yaml from 'js-yaml';
import camelCase from 'camelcase';
import { createForge, type Forge } from './forge.js';
import { GitLabForge } from './gitlab-forge.js';

interface Options {
  templatePath?: string;
  csvPath?: string;
  write?: boolean;
  comment?: boolean;
  githubToken?: string;
  liquid?: boolean;
  forge?: string;
  gitlabToken?: string;
  gitlabUrl?: string;
  [key: string]: string | boolean | undefined;
}

export class BulkIssueCreator {
  optionKeys = [
    'template_path',
    'csv_path',
    'write',
    'comment',
    'github_token',
    'liquid',
    'forge',
    'gitlab_token',
    'gitlab_url',
  ];
  boolOptions = ['write', 'comment', 'liquid'];
  defaultTemplatePath = './config/template.md.mustache';
  defaultCsvPath = './config/data.csv';
  _forge: Forge | undefined;
  _issues: Issue[] | undefined;
  _fetchOverride: typeof fetch | undefined;
  options: Record<string, string | boolean | null> = {
    templatePath: this.defaultTemplatePath,
    csvPath: this.defaultCsvPath,
    write: false,
    comment: false,
    githubToken: null,
    liquid: false,
    forge: 'github',
    gitlabToken: null,
    gitlabUrl: null,
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
        getInput(key.toUpperCase()) ||
        process.env[key.toUpperCase()] ||
        null;
      this.options[camelCaseKey] = this.boolOptions.includes(key)
        ? this.truthy(value)
        : value;
    }
  }

  // Allow tests to inject a custom fetch implementation
  setFetchOverride(fetchFn: typeof fetch) {
    this._fetchOverride = fetchFn;
    this._forge = undefined; // Reset cached forge
  }

  get forge(): Forge {
    if (this._forge === undefined) {
      this._forge = createForge({
        forge: this.options.forge as string | null,
        githubToken: this.options.githubToken as string | null,
        gitlabToken: this.options.gitlabToken as string | null,
        gitlabUrl: this.options.gitlabUrl as string | null,
        fetch: this._fetchOverride,
      });
    }
    return this._forge;
  }

  get templatePath(): string {
    return (this.options.templatePath as string) || this.defaultTemplatePath;
  }

  get csvPath(): string {
    return (this.options.csvPath as string) || this.defaultCsvPath;
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
    return fs.readFileSync(this.templatePath, 'utf8');
  }

  get issues(): Issue[] {
    if (this._issues === undefined) {
      const template = this.template;
      const liquid = this.options.liquid === true;
      this._issues = this.data.map((row) => new Issue(row, template, liquid));
    }
    return this._issues;
  }

  private get sanitizedOptions() {
    return {
      templatePath: this.templatePath,
      csvPath: this.csvPath,
      write: this.write,
      comment: this.comment,
      liquid: this.options.liquid,
      forge: this.forge.name,
      ...(this.forge instanceof GitLabForge
        ? { gitlabUrl: this.forge.host }
        : {}),
    };
  }

  async run() {
    info(`Running with options:\n${yaml.dump(this.sanitizedOptions)}`);

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
    let url: string;
    let failures = 0;

    for (const issue of this.issues) {
      if (!issue.title) {
        warning(`Issue title not found: ${JSON.stringify(issue.data)}`);
        failures++;
        continue;
      }

      if (!this.hasValidRepository(issue)) {
        failures++;
        continue;
      }

      try {
        url = await this.forge.createIssue(issue.repository, {
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
          assignees: issue.assignees,
        });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status !== undefined) {
          warning(
            `Error creating issue for ${issue.repository}: ${err.message} (${err.status})`,
          );
          failures++;
          continue;
        }
        throw error;
      }
      info(`Created issue ${url}`);
    }

    this.reportFailures(failures, 'issues');
  }

  private async createComments() {
    let url: string;
    let failures = 0;

    for (const issue of this.issues) {
      if (!issue.number) {
        warning(`Issue number not found: ${JSON.stringify(issue.data)}`);
        failures++;
        continue;
      }

      if (!this.hasValidRepository(issue)) {
        failures++;
        continue;
      }

      try {
        url = await this.forge.createComment(
          issue.repository,
          issue.number,
          issue.body,
        );
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status !== undefined) {
          warning(
            `Error creating comment for ${issue.repository}: ${err.message} (${err.status})`,
          );
          failures++;
          continue;
        }
        throw error;
      }
      info(`Created comment ${url}`);
    }

    this.reportFailures(failures, 'comments');
  }

  private hasValidRepository(issue: Issue): boolean {
    if (!this.forge.isValidRepository(issue.repository)) {
      const expected =
        this.forge.name === 'GitLab' ? 'group/project' : 'owner/repo';
      warning(
        `Invalid repository "${issue.repository}", expected ${expected}. Skipping...`,
      );
      return false;
    }
    return true;
  }

  // Keep going past individual failures, but fail the run so they aren't missed
  private reportFailures(failures: number, type: string) {
    if (failures > 0) {
      setFailed(`${failures} of ${this.issues.length} ${type} failed`);
    }
  }

  private get data(): IssueData[] {
    const csv = fs.readFileSync(this.csvPath, 'utf8');
    return parse(csv, { columns: true }) as IssueData[];
  }

  private ensurePathExists(path: string) {
    if (!fs.existsSync(path)) {
      throw new Error(`Path does not exist: ${path}`);
    }
  }

  async repoExists(repository: string) {
    try {
      await this.forge.getRepository(repository);
    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status !== undefined && err.status === 404) {
        warning(`Repository ${repository} does not exist. Skipping...`);
        return false;
      } else if (err.status !== undefined && err.status === 401) {
        warning(`Unauthorized access to repository ${repository}. Skipping...`);
        return false;
      } else {
        throw error;
      }
    }

    return true;
  }

  private truthy(value: string | boolean | null | undefined): boolean {
    return value === true || value === 'true';
  }

  private async previewOutput() {
    info('Running in READ ONLY mode. Pass `write` variable to write.');
    if (!this.forge.hasToken) {
      info(
        `Note: No ${this.forge.name} token provided. Skipping repository existence check.`,
      );
    }

    info(
      `The following ${this.comment ? 'comments' : 'issues'} would have been created:\n`,
    );

    for (const issue of this.issues) {
      info(yaml.dump(issue.data));
      if (!this.hasValidRepository(issue)) {
        continue;
      }
      if (this.forge.hasToken) {
        await this.repoExists(issue.repository);
      }
    }
  }
}
