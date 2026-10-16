import { GitHubForge } from './github-forge.js';
import { GitLabForge } from './gitlab-forge.js';

export interface NewIssue {
  title: string;
  body: string;
  labels: string[];
  assignees: string[];
}

// The few forge operations bulk-issue-creator needs. Each implementation wraps
// that forge's own SDK so retries, rate limits and auth stay the SDK's job.
//
// Request failures must be thrown as errors with a numeric `status` (the HTTP
// status) so callers can skip the row and keep going; anything else aborts.
export interface Forge {
  readonly name: string;
  readonly hasToken: boolean;
  isValidRepository(repository: string): boolean;
  // Resolves to the new issue's URL
  createIssue(repository: string, issue: NewIssue): Promise<string>;
  // Resolves to the new comment's URL
  createComment(
    repository: string,
    issueNumber: number,
    body: string,
  ): Promise<string>;
  // Throws an error with a `status` if the repository can't be read
  getRepository(repository: string): Promise<void>;
}

export const forgeNames = ['github', 'gitlab'] as const;
export type ForgeName = (typeof forgeNames)[number];

export interface ForgeOptions {
  forge?: string | null;
  githubToken?: string | null;
  gitlabToken?: string | null;
  gitlabUrl?: string | null;
  fetch?: typeof fetch;
}

export function createForge(options: ForgeOptions): Forge {
  const name = (options.forge || 'github').toLowerCase();
  switch (name) {
    case 'github':
      return new GitHubForge(options.githubToken ?? null, options.fetch);
    case 'gitlab':
      return new GitLabForge(options.gitlabToken ?? null, options.gitlabUrl, {
        fetch: options.fetch,
      });
    default:
      throw new Error(
        `Unknown forge "${options.forge}". Expected one of: ${forgeNames.join(', ')}`,
      );
  }
}
