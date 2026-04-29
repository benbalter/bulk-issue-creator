import * as fs from 'fs';
import { getInput, warning, info } from '@actions/core';
import { parse } from 'csv-parse/sync';
import { Issue } from './issue.js';
import * as yaml from 'js-yaml';
import { GitHub, getOctokitOptions } from '@actions/github/lib/utils';
import camelCase from 'camelcase';
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import { type OctokitOptions } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';

interface Options {
  templatePath?: string;
  csvPath?: string;
  write?: boolean;
  comment?: boolean;
  githubToken?: string;
  liquid?: boolean;
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
  ];
  boolOptions = ['write', 'comment', 'liquid'];
  defaultTemplatePath = './config/template.md.mustache';
  defaultCsvPath = './config/data.csv';
  _octokit: InstanceType<typeof GitHub> | undefined;
  _fetchOverride: typeof fetch | undefined;
  options: Record<string, string | boolean | null> = {
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
    this._octokit = undefined; // Reset cached octokit
  }

  get octokit() {
    // Return cached octokit instance if it exists
    if (this._octokit !== undefined) {
      return this._octokit;
    }

    const throttledOctokit = GitHub.plugin(throttling);

    const octokitOptions: OctokitOptions = {
      throttle: {
        onRateLimit: () => {
          warning('Hit rate limit, waiting to retry.');
          return true;
        },
        onSecondaryRateLimit: () => {
          warning('Hit secondary rate limit, waiting to retry.');
          return true;
        },
      },
      ...(this._fetchOverride
        ? { request: { fetch: this._fetchOverride } }
        : {}),
    };

    this._octokit = new throttledOctokit(
      getOctokitOptions(this.options.githubToken as string, octokitOptions),
    );

    return this._octokit;
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
    const issues: Issue[] = [];
    const data = this.data;
    for (const row of data) {
      const issue = new Issue(row, this.template, this.options.liquid === true);
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
    let response: RestEndpointMethodTypes['issues']['create']['response'];

    for (const issue of this.issues) {
      if (!issue.title) {
        warning(`Issue title not found: ${JSON.stringify(issue.data)}`);
        continue;
      }

      try {
        response = await this.octokit.rest.issues.create({
          owner: issue.nwo[0],
          repo: issue.nwo[1],
          title: issue.title,
          body: issue.body,
          labels: issue.labels,
          assignees: issue.assignees,
        });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status !== undefined) {
          warning(
            `Error creating issue for ${issue.nwo}: ${err.message} (${err.status})`,
          );
          continue;
        }
        throw error;
      }
      info(`Created issue ${response.data.html_url}`);
    }
  }

  private async createComments() {
    let response: RestEndpointMethodTypes['issues']['createComment']['response'];

    for (const issue of this.issues) {
      if (!issue.number) {
        warning(`Issue number not found: ${JSON.stringify(issue.data)}`);
        continue;
      }

      try {
        response = await this.octokit.rest.issues.createComment({
          owner: issue.nwo[0],
          repo: issue.nwo[1],
          issue_number: issue.number,
          body: issue.body,
        });
      } catch (error: unknown) {
        const err = error as { status?: number; message?: string };
        if (err.status !== undefined) {
          warning(
            `Error creating comment for ${issue.nwo}: ${err.message} (${err.status})`,
          );
          continue;
        }
        throw error;
      }
      info(`Created comment ${response.data.html_url}`);
    }
  }

  private get data() {
    const csv = fs.readFileSync(this.csvPath, 'utf8');
    return parse(csv, { columns: true });
  }

  private ensurePathExists(path: string) {
    if (!fs.existsSync(path)) {
      throw new Error(`Path does not exist: ${path}`);
    }
  }

  async repoExists(nwo: string) {
    const [owner, repo] = nwo.split('/');
    try {
      await this.octokit.rest.repos.get({
        owner,
        repo,
      });
    } catch (error: unknown) {
      const err = error as { status?: number };
      if (err.status !== undefined && err.status === 404) {
        warning(`Repository ${nwo} does not exist. Skipping...`);
        return false;
      } else if (err.status !== undefined && err.status === 401) {
        warning(`Unauthorized access to repository ${nwo}. Skipping...`);
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
    if (this.options.githubToken === null) {
      info(
        'Note: No GitHub token provided. Skipping repository existence check.',
      );
    }

    info(
      `The following ${this.comment ? 'comments' : 'issues'} would have been created:\n`,
    );

    for (const issue of this.issues) {
      info(yaml.dump(issue.data));
      if (this.options.githubToken !== null) {
        await this.repoExists(issue.repository);
      }
    }
  }
}
