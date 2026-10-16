import { warning } from '@actions/core';
import createClient, { type Client } from 'openapi-fetch';
import { type Forge, type NewIssue } from './forge.js';
import { type paths } from './gitlab-openapi.js';

const defaultHost = 'https://gitlab.com';
const maxAttempts = 4;
const maxRetryAfterMs = 60_000;

// openapi-fetch has no retries, so retry rate limits and server errors here.
// A 429 or 5xx means GitLab didn't act on the request, so retrying a POST is safe.
export function retryingFetch(
  fetchImpl: typeof fetch = fetch,
  baseDelayMs = 500,
) {
  return async (request: Request): Promise<Response> => {
    for (let attempt = 1; ; attempt++) {
      const response = await fetchImpl(request.clone());
      const retryable = response.status === 429 || response.status >= 500;
      if (!retryable || attempt === maxAttempts) {
        return response;
      }
      const retryAfter = Number(response.headers.get('retry-after'));
      const delay =
        Number.isFinite(retryAfter) && retryAfter > 0
          ? Math.min(retryAfter * 1000, maxRetryAfterMs)
          : baseDelayMs * 2 ** (attempt - 1);
      warning(
        `GitLab returned ${response.status}, retrying in ${delay / 1000}s.`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };
}

// Failures carry the HTTP status, like Octokit's, so callers can skip the row
function requestError(response: Response, error: unknown) {
  const message =
    (error as { message?: unknown; error?: unknown } | undefined)?.message ??
    (error as { error?: unknown } | undefined)?.error;
  const text =
    typeof message === 'string' ? message : JSON.stringify(message ?? error);
  return Object.assign(new Error(text || response.statusText), {
    status: response.status,
  });
}

export class GitLabForge implements Forge {
  readonly name = 'GitLab';
  token: string | null;
  host: string;
  fetchImpl: typeof fetch | undefined;
  retryDelayMs: number | undefined;
  _client: Client<paths> | undefined;

  // Defaults to the GitLab instance running the job in GitLab CI, then gitlab.com
  constructor(
    token: string | null,
    host?: string | null,
    options: { fetch?: typeof fetch; retryDelayMs?: number } = {},
  ) {
    this.token = token;
    this.host = (host || process.env.CI_SERVER_URL || defaultHost).replace(
      /\/+$/,
      '',
    );
    this.fetchImpl = options.fetch;
    this.retryDelayMs = options.retryDelayMs;
  }

  get hasToken() {
    return this.token !== null;
  }

  get client() {
    if (this._client === undefined) {
      this._client = createClient<paths>({
        baseUrl: this.host,
        // GitLab accepts personal, project and group access tokens as bearer tokens
        headers: this.token ? { Authorization: `Bearer ${this.token}` } : {},
        fetch: retryingFetch(this.fetchImpl, this.retryDelayMs),
      });
    }
    return this._client;
  }

  // GitLab projects can live in nested groups, e.g. group/subgroup/project
  isValidRepository(repository: string) {
    const parts = repository.split('/');
    return parts.length >= 2 && parts.every((part) => part !== '');
  }

  async createIssue(repository: string, issue: NewIssue) {
    const assigneeIds = await this.userIds(issue.assignees);
    if (assigneeIds.length > 1) {
      warning(
        `GitLab Free keeps only the first assignee; ${repository} may not get all of ${issue.assignees.join(', ')}.`,
      );
    }
    const { data, error, response } = await this.client.POST(
      '/api/v4/projects/{id}/issues',
      {
        params: { path: { id: repository } },
        body: {
          title: issue.title,
          description: issue.body,
          ...(issue.labels.length ? { labels: issue.labels } : {}),
          ...(assigneeIds.length ? { assignee_ids: assigneeIds } : {}),
        },
      },
    );
    if (!data) throw requestError(response, error);
    return data.web_url;
  }

  async createComment(repository: string, issueNumber: number, body: string) {
    const { data, error, response } = await this.client.POST(
      '/api/v4/projects/{id}/issues/{noteable_id}/notes',
      {
        params: { path: { id: repository, noteable_id: issueNumber } },
        body: { body },
      },
    );
    if (!data) throw requestError(response, error);
    return `${this.host}/${repository}/-/issues/${issueNumber}#note_${data.id}`;
  }

  async getRepository(repository: string) {
    const { data, error, response } = await this.client.GET(
      '/api/v4/projects/{id}',
      { params: { path: { id: repository } } },
    );
    if (!data) throw requestError(response, error);
  }

  // GitLab assigns by user ID, not username
  private async userIds(usernames: string[]) {
    const ids: number[] = [];
    for (const username of usernames) {
      const { data, error, response } = await this.client.GET('/api/v4/users', {
        params: { query: { username } },
      });
      if (!data) throw requestError(response, error);
      if (data[0]) {
        ids.push(data[0].id);
      } else {
        warning(`GitLab user "${username}" not found. Not assigning them.`);
      }
    }
    return ids;
  }
}
