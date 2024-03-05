import { BulkIssueCreator, sandbox } from "./bulk-issue-creator.js";
import { Issue, type IssueData } from "./issue.js";

describe("BulkIssueCreator", () => {
  let bulkIssueCreator: BulkIssueCreator;

  beforeEach(() => {
    process.env.INPUT_GITHUB_TOKEN = "TOKEN";
  });

  beforeAll(() => {
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
        templatePath: "./custom/template.md.mustache",
        csvPath: "./custom/data.csv",
        write: true,
        comment: true,
        githubToken: "TOKEN2",
      };

      beforeEach(() => {
        process.env.INPUT_GITHUB_TOKEN = "";
        bulkIssueCreator = new BulkIssueCreator(passedOptions);
      });

      it("should init with template path", () => {
        expect(bulkIssueCreator.templatePath).toEqual(
          passedOptions.templatePath,
        );
      });

      it("should init with csv path", () => {
        expect(bulkIssueCreator.csvPath).toEqual(passedOptions.csvPath);
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

    describe("options passed as environmental variables", () => {
      beforeAll(() => {
        process.env.INPUT_GITHUB_TOKEN = "";
        process.env.TEMPLATE_PATH = "./env/template.md.mustache";
        process.env.CSV_PATH = "./env/data.csv";
        process.env.GITHUB_TOKEN = "TOKEN3";
      });

      afterAll(() => {
        delete process.env.TEMPLATE_PATH;
        delete process.env.CSV_PATH;
        delete process.env.GITHUB_TOKEN;
      });

      beforeEach(() => {
        bulkIssueCreator = new BulkIssueCreator();
      });

      it("should init with template path", () => {
        expect(bulkIssueCreator.templatePath).toEqual(
          "./env/template.md.mustache",
        );
      });

      it("should init with csv path", () => {
        expect(bulkIssueCreator.csvPath).toEqual("./env/data.csv");
      });

      it("should init with github token", () => {
        expect(bulkIssueCreator.octokit).toBeDefined();
      });
    });
  });

  describe("repoExists", () => {
    beforeAll(() => {
      sandbox.reset();
    });

    it("should return true if the repository exists", async () => {
      sandbox.get("https://api.github.com/repos/owner/repo", {
        name: "repo",
        owner: { login: "owner" },
      });
      const result = await bulkIssueCreator.repoExists("owner/repo");
      expect(result).toEqual(true);
    });

    it("should return false if the repository does not exist", async () => {
      sandbox.get("https://api.github.com/repos/owner/not-repo", 404);
      const result = await bulkIssueCreator.repoExists("owner/not-repo");
      expect(result).toEqual(false);
    });

    it("should return false if the request is unauthorized", async () => {
      sandbox.get("https://api.github.com/repos/owner/secret-repo", 401);
      const result = await bulkIssueCreator.repoExists("owner/secret-repo");
      expect(result).toEqual(false);
    });
  });

  describe("with fixtures", () => {
    beforeAll(() => {
      process.env.INPUT_TEMPLATE_PATH = "./fixtures/template.md.mustache";
      process.env.INPUT_CSV_PATH = "./fixtures/data.csv";
    });

    afterAll(() => {
      delete process.env.INPUT_TEMPLATE_PATH;
      delete process.env.INPUT_CSV_PATH;
    });

    beforeEach(() => {
      bulkIssueCreator = new BulkIssueCreator();
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
      expect(async () => {
        bulkIssueCreator.run();
      }).not.toThrow();
    });

    describe("when write option is true", () => {
      beforeAll(() => {
        process.env.INPUT_WRITE = "true";
      });

      it("should create issues", async () => {
        const mock = sandbox.post(
          "https://api.github.com/repos/owner/repo/issues",
          {
            title: "Test issue",
            body: "Hello World!",
            labels: ["bug", "enhancement"],
            assignees: ["user1", "user2"],
            owner: "owner",
            repo: "repo",
            html_url: "https://github.com/owner/repo/issues/1",
          },
        );
        await bulkIssueCreator.run();
        expect(mock.called).toBeTruthy();
      });

      it("Should handle request errors", async () => {
        sandbox.reset();
        sandbox.post("https://api.github.com/repos/owner/repo/issues", {
          body: "Issues disabled",
          status: 410,
        });
        await expect(async () => {
          bulkIssueCreator.run();
        }).not.toThrow();
      });

      describe("when comment option is true", () => {
        beforeAll(() => {
          process.env.INPUT_COMMENT = "true";
        });

        it("should create comments", async () => {
          const mock = sandbox.post(
            "https://api.github.com/repos/owner/repo/issues/1/comments",
            {
              body: "Hello World!",
              owner: "owner",
              repo: "repo",
              html_url:
                "https://api.github.com/repos/owner/repo/issues/1#issuecomment-1",
            },
          );
          await bulkIssueCreator.run();
          expect(mock.called).toBeTruthy();
        });

        it("Should handle request errors", async () => {
          sandbox.reset();
          sandbox.post(
            "https://api.github.com/repos/owner/repo/issues/1/comments",
            { body: "Issues disabled", status: 410 },
          );
          await expect(async () => {
            bulkIssueCreator.run();
          }).not.toThrow();
        });
      });
    });
  });
});
