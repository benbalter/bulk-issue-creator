import { Issue, type IssueData } from './issue.js';

describe('Issue', () => {
  const data: IssueData = {
    title: 'Hello, {{name}}!',
    name: 'GitHub Copilot',
    labels: 'bug, enhancement',
    assignees: 'octocat, hubot',
    repository: 'octocat/hello-world',
    issue_number: '1',
    html_url: 'https://github.com/octocat/hello-world/issues/1',
  };
  const template = 'Hello, {{name}}!';
  let issue: Issue;

  beforeEach(() => {
    issue = new Issue(data, template);
  });

  it('should render the title using mustache', () => {
    const expected = 'Hello, GitHub Copilot!';
    expect(issue.title).toEqual(expected);
  });

  it('should render the body using mustache', () => {
    const expected = 'Hello, GitHub Copilot!';
    expect(issue.body).toEqual(expected);
  });

  it('should not HTML-escape rendered values', () => {
    const raw = { ...data, name: `Ben's <app> & "stuff"` };
    issue = new Issue(raw, template);
    const expected = `Hello, Ben's <app> & "stuff"!`;
    expect(issue.title).toEqual(expected);
    expect(issue.body).toEqual(expected);
  });

  it('should return empty arrays for blank labels and assignees', () => {
    issue = new Issue({ ...data, labels: '', assignees: ' , ' }, template);
    expect(issue.labels).toEqual([]);
    expect(issue.assignees).toEqual([]);
  });

  it('should return an empty title when the row has none', () => {
    issue = new Issue({ ...data, title: undefined } as IssueData, template);
    expect(issue.title).toEqual('');
    expect(issue.data.title).toEqual('');
  });

  describe('with liquid', () => {
    it('should render the body using liquid', () => {
      const template = '{% assign hello = "Hello," %}{{ hello }} {{ name }}!';
      issue = new Issue(data, template, true);
      const expected = 'Hello, GitHub Copilot!';
      expect(issue.body).toEqual(expected);
    });
  });

  it('should return the labels as an array', () => {
    const expected = ['bug', 'enhancement'];
    expect(issue.labels).toEqual(expected);
  });

  it('should return the assignees as an array', () => {
    const expected = ['octocat', 'hubot'];
    expect(issue.assignees).toEqual(expected);
  });

  it('should return the repository', () => {
    const expected = 'octocat/hello-world';
    expect(issue.repository).toEqual(expected);
  });

  it('should strip github.com/ from the repository', () => {
    const dataWithUrl = {
      ...data,
      repository: 'https://github.com/owner/repo',
    };
    issue = new Issue(dataWithUrl, template);
    const expected = 'owner/repo';
    expect(issue.repository).toEqual(expected);
  });

  it('should strip any forge URL, .git and trailing slashes', () => {
    for (const repository of [
      'https://gitlab.com/group/sub/project',
      'https://gitlab.example.com/group/sub/project.git',
      'https://gitlab.com/group/sub/project/',
    ]) {
      issue = new Issue({ ...data, repository }, template);
      expect(issue.repository).toEqual('group/sub/project');
    }
  });

  it('should return the issue number', () => {
    const expected = 1;
    expect(issue.number).toEqual(expected);
  });

  it('should return the repository owner and name', () => {
    const expected = ['octocat', 'hello-world'];
    expect(issue.nwo).toEqual(expected);
  });
});
