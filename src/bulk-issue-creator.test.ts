import { BulkIssueCreator, sandbox } from "./bulk-issue-creator";
import { Issue, type IssueData } from "./issue";


describe("BulkIssueCreator", () => {
  let bulkIssueCreator: BulkIssueCreator;

  beforeAll(() => {
    process.env.INPUT_TOKEN = "TOKEN";
    sandbox.get("https://api.github.com/repos/owner/repo", {
      name: "repo",
      owner: { login: "owner" },
    });
  });

  beforeEach(() => {
    bulkIssueCreator = new BulkIssueCreator();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      expect(bulkIssueCreator.templatePath).toEqual(
        "./config/template.md.mustache",
      );
      expect(bulkIssueCreator.csvPath).toEqual("./config/data.csv");
      expect(bulkIssueCreator.write).toEqual(false);
      expect(bulkIssueCreator.comment).toEqual(false);
    });

    describe("when options are passed", () => {
      const passedOptions = {
        template_path: "./custom/template.md.mustache",
        csv_path: "./custom/data.csv",
        write: true,
        comment: true,
        github_token: "TOKEN",
      };

      beforeEach(() => {
        bulkIssueCreator = new BulkIssueCreator(passedOptions);
      });

      it("should init with template path", () => {
        expect(bulkIssueCreator.templatePath).toEqual(
          passedOptions.template_path,
        );
      });

      it("should init with csv path", () => {
        expect(bulkIssueCreator.csvPath).toEqual(passedOptions.csv_path);
      });

      it("should init with write option", () => {
        expect(bulkIssueCreator.write).toEqual(true);
      });

      it("should init with comment option", () => {
        expect(bulkIssueCreator.comment).toEqual(true);
      });

      it("should init with github token", () => {
        expect(bulkIssueCreator.octokit).toBeDefined();
      });
    });
  });

  it("should return the contents of the template", () => {
    const expected = "Hello {{name}}!";
    expect(bulkIssueCreator.template).toEqual(expected);
  });

  it("should return the issues", () => {
    const data: IssueData = {
      assignees: "user1, user2",
      issue_number: "1",
      labels: "bug, enhancement",
      name: "World",
      repository: "owner/repo",
      title: "Test issue",
    };
    const issue = new Issue(data, "Hello {{name}}!");
    expect(bulkIssueCreator.issues).toEqual([issue]);
  });

  it("should run in preview mode", async () => {
    await bulkIssueCreator.run();
  });

  describe("when write option is true", () => {
    beforeAll(() => {
      process.env.INPUT_WRITE = "true";
    });

    it("should create issues", async () => {
      const mock = sandbox.post("https://api.github.com/repos/owner/repo/issues",
      {
        title: "Test issue",
        body: "Hello World!",
        labels: ["bug", "enhancement"],
        assignees: ["user1", "user2"],
        owner: "owner",
        repo: "repo",
      });
      await bulkIssueCreator.run();
      expect(mock.called).toBeTruthy();
    });

    describe("when comment option is true", () => {
      beforeAll(() => {
        process.env.INPUT_COMMENT = "true";
      });

      it("should create comments", async () => {
        const mock = sandbox.post("https://api.github.com/repos/owner/repo/issues/1/comments", {
          body: "Hello World!",
          owner: "owner",
          repo: "repo",
        });
        await bulkIssueCreator.run();
        expect(mock.called).toBeTruthy();
      });
    });
  });
});
