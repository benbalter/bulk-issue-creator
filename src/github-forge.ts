import { warning } from '@actions/core';
import { GitHub, getOctokitOptions } from '@actions/github/lib/utils';
import { type OctokitOptions } from '@octokit/core';
import { throttling } from '@octokit/plugin-throttling';
import { type Forge, type NewIssue } from './forge.js';

export class GitHubForge implements Forge {
  readonly name = 'GitHub';
  token: string | null;
  fetchOverride: typeof fetch | undefined;
  _octokit: InstanceType<typeof GitHub> | undefined;

  constructor(token: string | null, fetchOverride?: typeof fetch) {
    this.token = token;
    this.fetchOverride = fetchOverride;
  }

  get hasToken() {
    return this.token !== null;
  }

  get octokit() {
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
      ...(this.fetchOverride ? { request: { fetch: this.fetchOverride } } : {}),
    };

    this._octokit = new throttledOctokit(
      getOctokitOptions(this.token as string, octokitOptions),
    );

    return this._octokit;
  }

  isValidRepository(repository: string) {
    const parts = repository.split('/');
    return parts.length === 2 && parts.every((part) => part !== '');
  }

  async createIssue(repository: string, issue: NewIssue) {
    const [owner, repo] = repository.split('/');
    const response = await this.octokit.rest.issues.create({
      owner,
      repo,
      ...issue,
    });
    return response.data.html_url;
  }

  async createComment(repository: string, issueNumber: number, body: string) {
    const [owner, repo] = repository.split('/');
    const response = await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: issueNumber,
      body,
    });
    return response.data.html_url;
  }

  async getRepository(repository: string) {
    const [owner, repo] = repository.split('/');
    await this.octokit.rest.repos.get({ owner, repo });
  }
}
