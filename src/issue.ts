import * as mustache from "mustache";

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

  constructor(data: IssueData, template: string) {
    this.data = data;
    this.template = template;
  }

  get title() {
    return mustache.render(this.data.title, this.data);
  }

  get body() {
    return mustache.render(this.template, this.data);
  }

  get labels() {
    return this.data.labels?.split(",").map((label) => label.trim());
  }

  get assignees() {
    return this.data.assignees?.split(",").map((assignee) => assignee.trim());
  }

  get repository() {
    return this.data.repository;
  }

  get number() {
    return this.data.issue_number;
  }

  get nwo() {
    return this.data.repository.split("/");
  }
}
