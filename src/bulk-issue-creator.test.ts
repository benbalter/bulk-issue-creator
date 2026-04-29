import { BulkIssueCreator } from './bulk-issue-creator.js';
import { Issue, type IssueData } from './issue.js';
import fetchMock from 'fetch-mock';

const sandbox = fetchMock.sandbox();

// Wrap fetch-mock sandbox to return proper Headers objects
// that implement Symbol.iterator (required by @octokit/request)
const wrappedSandbox = (async (
  input: string | Request | URL,
  init?: RequestInit,
) => {
  const response = await sandbox(
    String(input),
    init as RequestInit | undefined,
  );
  const headers = new Headers();
  if (response.headers) {
    const rawHeaders = response.headers as unknown as {
      raw?: () => Record<string, string[]>;
    };
    if (rawHeaders.raw) {
      Object.entries(rawHeaders.raw()).forEach(([key, values]) => {
        values.forEach((v) => headers.append(key, v));
      });
    }
  }
  const body = await response.text();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}) as typeof fetch;

describe('BulkIssueCreator', () => {
  let bulkIssueCreator: BulkIssueCreator;

  beforeEach(() => {
    process.env.INPUT_GITHUB_TOKEN = 'TOKEN';
  });

  beforeAll(() => {
    sandbox.get('https://api.github.com/repos/owner/repo', {
      name: 'repo',
      owner: { login: 'owner' },
    });
  });

  beforeEach(() => {
    bulkIssueCreator = new BulkIssueCreator();
    bulkIssueCreator.setFetchOverride(wrappedSandbox);
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      expect(bulkIssueCreator.templatePath).toEqual(
        './config/template.md.mustache',
      );
      expect(bulkIssueCreator.csvPath).toEqual('./config/data.csv');
      expect(bulkIssueCreator.write).toEqual(false);
      expect(bulkIssueCreator.comment).toEqual(false);
    });

    describe('when options are passed', () => {
      const passedOptions = {
        templatePath: './custom/template.md.mustache',
        csvPath: './custom/data.csv',
        write: true,
        comment: true,
        githubToken: 'TOKEN2',
      };

      beforeEach(() => {
        process.env.INPUT_GITHUB_TOKEN = '';
        bulkIssueCreator = new BulkIssueCreator(passedOptions);
      });

      it('should init with template path', () => {
        expect(bulkIssueCreator.templatePath).toEqual(
          passedOptions.templatePath,
        );
      });

      it('should init with csv path', () => {
        expect(bulkIssueCreator.csvPath).toEqual(passedOptions.csvPath);
      });

      it('should init with write option', () => {
        expect(bulkIssueCreator.write).toEqual(true);
      });

      it('should init with comment option', () => {
        expect(bulkIssueCreator.comment).toEqual(true);
      });

      it('should init with github token', () => {
        expect(bulkIssueCreator.octokit).toBeDefined();
      });
    });

    describe('options passed as environmental variables', () => {
      beforeAll(() => {
        process.env.INPUT_GITHUB_TOKEN = '';
        process.env.TEMPLATE_PATH = './env/template.md.mustache';
        process.env.CSV_PATH = './env/data.csv';
        process.env.GITHUB_TOKEN = 'TOKEN3';
      });

      afterAll(() => {
        delete process.env.TEMPLATE_PATH;
        delete process.env.CSV_PATH;
        delete process.env.GITHUB_TOKEN;
      });

      beforeEach(() => {
        bulkIssueCreator = new BulkIssueCreator();
      });

      it('should init with template path', () => {
        expect(bulkIssueCreator.templatePath).toEqual(
          './env/template.md.mustache',
        );
      });

      it('should init with csv path', () => {
        expect(bulkIssueCreator.csvPath).toEqual('./env/data.csv');
      });

      it('should init with github token', () => {
        expect(bulkIssueCreator.octokit).toBeDefined();
      });
    });
  });

  describe('repoExists', () => {
    beforeAll(() => {
      sandbox.reset();
    });

    it('should return true if the repository exists', async () => {
      sandbox.get('https://api.github.com/repos/owner/repo', {
        status: 200,
        body: { name: 'repo', owner: { login: 'owner' } },
        headers: { 'content-type': 'application/json' },
      });
      const result = await bulkIssueCreator.repoExists('owner/repo');
      expect(result).toEqual(true);
    });

    it('should return false if the repository does not exist', async () => {
      sandbox.get('https://api.github.com/repos/owner/not-repo', {
        status: 404,
        body: { message: 'Not Found' },
        headers: { 'content-type': 'application/json' },
      });
      const result = await bulkIssueCreator.repoExists('owner/not-repo');
      expect(result).toEqual(false);
    });

    it('should return false if the request is unauthorized', async () => {
      sandbox.get('https://api.github.com/repos/owner/secret-repo', {
        status: 401,
        body: { message: 'Bad credentials' },
        headers: { 'content-type': 'application/json' },
      });
      const result = await bulkIssueCreator.repoExists('owner/secret-repo');
      expect(result).toEqual(false);
    });
  });

  describe('with fixtures', () => {
    beforeAll(() => {
      process.env.INPUT_TEMPLATE_PATH = './fixtures/template.md.mustache';
      process.env.INPUT_CSV_PATH = './fixtures/data.csv';
      sandbox.reset();
      sandbox.get('https://api.github.com/repos/owner/repo', {
        name: 'repo',
        owner: { login: 'owner' },
      });
    });

    afterAll(() => {
      delete process.env.INPUT_TEMPLATE_PATH;
      delete process.env.INPUT_CSV_PATH;
    });

    beforeEach(() => {
      bulkIssueCreator = new BulkIssueCreator();
      bulkIssueCreator.setFetchOverride(wrappedSandbox);
    });

    it('should return the contents of the template', () => {
      const expected = 'Hello {{name}}!';
      expect(bulkIssueCreator.template).toEqual(expected);
    });

    it('should return the issues', () => {
      const data: IssueData = {
        assignees: 'user1, user2',
        issue_number: '1',
        labels: 'bug, enhancement',
        name: 'World',
        repository: 'owner/repo',
        title: 'Test issue',
      };
      const issue = new Issue(data, 'Hello {{name}}!');
      expect(bulkIssueCreator.issues).toEqual([issue]);
    });

    it('should run in preview mode', async () => {
      expect(async () => {
        bulkIssueCreator.run();
      }).not.toThrow();
    });

    describe('when write option is true', () => {
      beforeAll(() => {
        process.env.INPUT_WRITE = 'true';
      });

      it('should create issues', async () => {
        const mock = sandbox.post(
          'https://api.github.com/repos/owner/repo/issues',
          {
            title: 'Test issue',
            body: 'Hello World!',
            labels: ['bug', 'enhancement'],
            assignees: ['user1', 'user2'],
            owner: 'owner',
            repo: 'repo',
            html_url: 'https://github.com/owner/repo/issues/1',
          },
        );
        await bulkIssueCreator.run();
        expect(mock.called).toBeTruthy();
      });

      it('Should handle request errors', async () => {
        sandbox.reset();
        sandbox.post('https://api.github.com/repos/owner/repo/issues', {
          body: 'Issues disabled',
          status: 410,
        });
        await expect(async () => {
          bulkIssueCreator.run();
        }).not.toThrow();
      });

      describe('when comment option is true', () => {
        beforeAll(() => {
          process.env.INPUT_COMMENT = 'true';
        });

        it(
          'should create comments',
          async () => {
            const mock = sandbox.post(
              'https://api.github.com/repos/owner/repo/issues/1/comments',
              {
                body: 'Hello World!',
                owner: 'owner',
                repo: 'repo',
                html_url:
                  'https://api.github.com/repos/owner/repo/issues/1#issuecomment-1',
              },
            );
            await bulkIssueCreator.run();
            expect(mock.called).toBeTruthy();
          },
          7 * 1000,
        );

        it('Should handle request errors', async () => {
          sandbox.reset();
          sandbox.post(
            'https://api.github.com/repos/owner/repo/issues/1/comments',
            { body: 'Issues disabled', status: 410 },
          );
          await expect(async () => {
            bulkIssueCreator.run();
          }).not.toThrow();
        });
      });
    });
  });
});
