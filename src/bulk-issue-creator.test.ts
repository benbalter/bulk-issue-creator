import { BulkIssueCreator } from "./bulk-issue-creator";

describe("BulkIssueCreator", () => {
  let bulkIssueCreator: BulkIssueCreator;

  beforeEach(() => {
    bulkIssueCreator = new BulkIssueCreator();
  });

  describe("constructor", () => {
    it("should initialize with default options", () => {
      expect(bulkIssueCreator.templatePath).toEqual(
        "./config/template.md.mustache"
      );
      expect(bulkIssueCreator.csvPath).toEqual(
        "./config/data.csv"
      );
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
          passedOptions.template_path
        );
      });

      it("should init with csv path", () => {
        expect(bulkIssueCreator.csvPath).toEqual(
          passedOptions.csv_path
        );
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
});
