import mustache from "mustache";
import { Liquid } from "liquidjs";
import * as core from "@actions/core";

export interface IssueData {
  title: string;
  labels?: string;
  assignees?: string;
  repository?: string;
  issue_number?: string;
  [key: string]: string | string;
}

export class Issue {
  data: IssueData;
  template: string;
  liquid: boolean;

  constructor(data: IssueData, template: string, liquid: boolean = false) {
    this.data = data;
    this.template = template;
    this.liquid = liquid;
  }

  get title() {
    return mustache.render(this.data.title, this.data);
  }

  get body() {
    if (this.liquid === true) {
      const engine = new Liquid();
      return engine.parseAndRenderSync(this.template, this.data);
    }
    return mustache.render(this.template, this.data);
  }

  get labels() {
    return this.data.labels?.split(",").map((label) => label.trim());
  }

  get assignees() {
    const assignees = this.data.assignees || this.data.assignee;
    if (!assignees) {
      return [];
    }
    return assignees
      .split(",")
      .map((assignee) => assignee.trim().replace("@", ""));
  }

  get repository() {
    if (!this.data.repository) {
      core.warning("Repository not found in row: ", this.data);
    }
    return this.data.repository.replace("https://github.com/", "");
  }

  get number() {
    return Number(this.data.issue_number);
  }

  get nwo() {
    const parts = this.repository?.split("/");
    if (parts.length !== 2) {
      core.warning(`Invalid repository format: ${this.repository}`);
    }
    return parts;
  }
}
