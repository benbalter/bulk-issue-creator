import { BulkIssueCreator } from './bulk-issue-creator.js';
import { Issue, type IssueData } from './issue.js';
import fetchMock from 'fetch-mock';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const sandbox = fetchMock.createInstance();
const ISSUES_URL = 'https://api.github.com/repos/owner/repo/issues';
const COMMENTS_URL =
  'https://api.github.com/repos/owner/repo/issues/1/comments';

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
    bulkIssueCreator.setFetchOverride(sandbox.fetchHandler);
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
      sandbox.removeRoutes().clearHistory();
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
      sandbox.removeRoutes().clearHistory();
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
      bulkIssueCreator.setFetchOverride(sandbox.fetchHandler);
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
        expect(mock.callHistory.called(ISSUES_URL, { method: 'POST' })).toBe(
          true,
        );
      });

      it('Should handle request errors', async () => {
        sandbox.removeRoutes().clearHistory();
        sandbox.post('https://api.github.com/repos/owner/repo/issues', {
          body: 'Issues disabled',
          status: 410,
        });
        await expect(bulkIssueCreator.run()).resolves.toBeUndefined();
        expect(process.exitCode).toEqual(1);
        process.exitCode = undefined;
      });

      it('should skip rows with an invalid repository', async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bic-'));
        const csvPath = path.join(dir, 'data.csv');
        fs.writeFileSync(
          csvPath,
          'title,repository\nBad row,not-a-repo\nGood row,owner/repo\n',
        );
        sandbox.removeRoutes().clearHistory();
        const mock = sandbox.post(
          'https://api.github.com/repos/owner/repo/issues',
          { html_url: 'https://github.com/owner/repo/issues/2' },
        );
        bulkIssueCreator = new BulkIssueCreator({ csvPath });
        bulkIssueCreator.setFetchOverride(sandbox.fetchHandler);
        await bulkIssueCreator.run();
        expect(
          mock.callHistory.calls(ISSUES_URL, { method: 'POST' }),
        ).toHaveLength(1);
        expect(process.exitCode).toEqual(1);
        process.exitCode = undefined;
        fs.rmSync(dir, { recursive: true });
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
            expect(
              mock.callHistory.called(COMMENTS_URL, { method: 'POST' }),
            ).toBe(true);
          },
          7 * 1000,
        );

        it('Should handle request errors', async () => {
          sandbox.removeRoutes().clearHistory();
          sandbox.post(
            'https://api.github.com/repos/owner/repo/issues/1/comments',
            { body: 'Issues disabled', status: 410 },
          );
          await expect(bulkIssueCreator.run()).resolves.toBeUndefined();
          expect(process.exitCode).toEqual(1);
          process.exitCode = undefined;
        });
      });
    });
  });
});
