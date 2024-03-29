import { Issue, type IssueData } from "./issue.js";

describe("Issue", () => {
  const data: IssueData = {
    title: "Hello, {{name}}!",
    name: "GitHub Copilot",
    labels: "bug, enhancement",
    assignees: "octocat, hubot",
    repository: "octocat/hello-world",
    issue_number: "1",
    html_url: "https://github.com/octocat/hello-world/issues/1",
  };
  const template = "Hello, {{name}}!";
  let issue: Issue;

  beforeEach(() => {
    issue = new Issue(data, template);
  });

  it("should render the title using mustache", () => {
    const expected = "Hello, GitHub Copilot!";
    expect(issue.title).toEqual(expected);
  });

  it("should render the body using mustache", () => {
    const expected = "Hello, GitHub Copilot!";
    expect(issue.body).toEqual(expected);
  });

  describe("with liquid", () => {
    beforeAll(() => {
      process.env.USE_LIQUID = "true";
    });

    afterAll(() => {
      delete process.env.USE_LIQUID;
    });

    it("should render the body using liquid", () => {
      const template = '{% assign hello = "Hello," %}{{ hello }} {{ name }}!';
      issue = new Issue(data, template, true);
      const expected = "Hello, GitHub Copilot!";
      expect(issue.body).toEqual(expected);
    });
  });

  it("should return the labels as an array", () => {
    const expected = ["bug", "enhancement"];
    expect(issue.labels).toEqual(expected);
  });

  it("should return the assignees as an array", () => {
    const expected = ["octocat", "hubot"];
    expect(issue.assignees).toEqual(expected);
  });

  it("should return the repository", () => {
    const expected = "octocat/hello-world";
    expect(issue.repository).toEqual(expected);
  });

  it("should strip github.com/ from the repository", () => {
    const dataWithUrl = {
      ...data,
      repository: "https://github.com/owner/repo",
    };
    issue = new Issue(dataWithUrl, template);
    const expected = "owner/repo";
    expect(issue.repository).toEqual(expected);
  });

  it("should return the issue number", () => {
    const expected = 1;
    expect(issue.number).toEqual(expected);
  });

  it("should return the repository owner and name", () => {
    const expected = ["octocat", "hello-world"];
    expect(issue.nwo).toEqual(expected);
  });
});
