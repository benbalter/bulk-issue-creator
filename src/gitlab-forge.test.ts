import fetchMock from 'fetch-mock';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BulkIssueCreator } from './bulk-issue-creator.js';
import { createForge } from './forge.js';
import { GitLabForge } from './gitlab-forge.js';

const sandbox = fetchMock.createInstance();
const API = 'https://gitlab.example.com/api/v4';
const PROJECT = `${API}/projects/group%2Fsub%2Fproject`;
const json = (body: unknown, status = 200) => ({
  status,
  body,
  headers: { 'content-type': 'application/json' },
});

describe('GitLabForge', () => {
  let forge: GitLabForge;

  beforeEach(() => {
    sandbox.removeRoutes().clearHistory();
    forge = new GitLabForge('TOKEN', 'https://gitlab.example.com/', {
      fetch: sandbox.fetchHandler,
      retryDelayMs: 0,
    });
  });

  it('should be created by createForge', () => {
    const created = createForge({ forge: 'GitLab', gitlabToken: 'TOKEN' });
    expect(created).toBeInstanceOf(GitLabForge);
    expect((created as GitLabForge).host).toEqual('https://gitlab.com');
  });

  it('should reject unknown forges', () => {
    expect(() => createForge({ forge: 'bitbucket' })).toThrow(
      'Unknown forge "bitbucket". Expected one of: github, gitlab',
    );
  });

  it('should default to the CI server URL', () => {
    process.env.CI_SERVER_URL = 'https://ci.example.com';
    expect(new GitLabForge(null).host).toEqual('https://ci.example.com');
    delete process.env.CI_SERVER_URL;
  });

  it('should report whether it has a token', () => {
    expect(forge.hasToken).toEqual(true);
    expect(new GitLabForge(null).hasToken).toEqual(false);
  });

  it('should accept nested group paths', () => {
    expect(forge.isValidRepository('group/sub/project')).toEqual(true);
    expect(forge.isValidRepository('group/project')).toEqual(true);
    expect(forge.isValidRepository('project')).toEqual(false);
    expect(forge.isValidRepository('group//project')).toEqual(false);
  });

  it('should create an issue with labels and assignees', async () => {
    sandbox.get(`begin:${API}/users?username=alice`, json([{ id: 7 }]));
    sandbox.get(`begin:${API}/users?username=ghost`, json([]));
    sandbox.post(
      `${PROJECT}/issues`,
      json(
        { web_url: 'https://gitlab.example.com/group/sub/project/-/issues/3' },
        201,
      ),
    );

    const url = await forge.createIssue('group/sub/project', {
      title: 'Title',
      body: 'Body',
      labels: ['bug', 'help wanted'],
      assignees: ['alice', 'ghost'],
    });

    expect(url).toEqual(
      'https://gitlab.example.com/group/sub/project/-/issues/3',
    );
    const call = sandbox.callHistory.lastCall(`${PROJECT}/issues`);
    expect(call?.request?.headers.get('authorization')).toEqual('Bearer TOKEN');
    expect(await call?.request?.json()).toEqual({
      title: 'Title',
      description: 'Body',
      labels: ['bug', 'help wanted'],
      assignee_ids: [7],
    });
  });

  it('should create a comment and link to it', async () => {
    sandbox.post(`${PROJECT}/issues/3/notes`, json({ id: 42 }, 201));
    const url = await forge.createComment('group/sub/project', 3, 'Hi');
    expect(url).toEqual(
      'https://gitlab.example.com/group/sub/project/-/issues/3#note_42',
    );
  });

  it('should expose the HTTP status on request errors', async () => {
    sandbox.get(PROJECT, json({ message: '404 Project Not Found' }, 404));
    await expect(
      forge.getRepository('group/sub/project'),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('should retry rate limits and server errors', async () => {
    let calls = 0;
    sandbox.get(PROJECT, () =>
      ++calls < 3 ? json({}, calls === 1 ? 429 : 502) : json({ id: 1 }),
    );
    await forge.getRepository('group/sub/project');
    expect(calls).toEqual(3);
  });

  it('should give up after four attempts', async () => {
    sandbox.post(`${PROJECT}/issues/3/notes`, json({ message: 'down' }, 503));
    await expect(
      forge.createComment('group/sub/project', 3, 'Hi'),
    ).rejects.toMatchObject({ status: 503, message: 'down' });
    expect(sandbox.callHistory.calls()).toHaveLength(4);
  });

  it('should surface GitLab validation messages', async () => {
    sandbox.post(
      `${PROJECT}/issues`,
      json({ message: { title: ['is too long'] } }, 400),
    );
    await expect(
      forge.createIssue('group/sub/project', {
        title: 'x',
        body: '',
        labels: [],
        assignees: [],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: '{"title":["is too long"]}',
    });
  });

  it('should create issues from a CSV of GitLab URLs', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bic-'));
    const csvPath = path.join(dir, 'data.csv');
    const templatePath = path.join(dir, 'template.md');
    fs.writeFileSync(
      csvPath,
      'title,repository\nHi,https://gitlab.example.com/group/sub/project\n',
    );
    fs.writeFileSync(templatePath, 'Hello');
    sandbox.post(`${PROJECT}/issues`, json({ web_url: 'url' }, 201));

    const creator = new BulkIssueCreator({
      csvPath,
      templatePath,
      write: true,
      forge: 'gitlab',
      gitlabToken: 'TOKEN',
      gitlabUrl: 'https://gitlab.example.com',
    });
    creator.setFetchOverride(sandbox.fetchHandler);
    await creator.run();

    expect(sandbox.callHistory.called(`${PROJECT}/issues`)).toBe(true);
    expect(process.exitCode).toBeUndefined();
    fs.rmSync(dir, { recursive: true });
  });
});
