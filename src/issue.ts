import mustache from 'mustache';
import { Liquid } from 'liquidjs';
import * as core from '@actions/core';

export interface IssueData {
  title: string;
  labels?: string;
  assignees?: string;
  assignee?: string;
  repository?: string;
  issue_number?: string;
  [key: string]: string | undefined;
}

export class Issue {
  _data: IssueData;
  template: string;
  liquid: boolean;

  constructor(data: IssueData, template: string, liquid: boolean = false) {
    this._data = data;
    this.template = template;
    this.liquid = liquid;
  }

  get title() {
    return mustache.render(this._data.title, this._data);
  }

  get body() {
    if (this.liquid === true) {
      const engine = new Liquid();
      return engine.parseAndRenderSync(this.template, this._data);
    }
    return mustache.render(this.template, this._data);
  }

  get labels() {
    return this._data.labels?.split(',').map((label) => label.trim());
  }

  get assignees() {
    const assignees = this._data.assignees || this._data.assignee;
    if (!assignees) {
      return [];
    }
    return assignees
      .split(',')
      .map((assignee) => assignee.trim().replace('@', ''));
  }

  get repository(): string {
    if (!this._data.repository) {
      core.warning(
        'Repository not found in row: ' + JSON.stringify(this._data),
      );
      return '';
    }
    return this._data.repository.replace('https://github.com/', '');
  }

  get number() {
    return Number(this._data.issue_number);
  }

  get nwo(): string[] {
    const parts = this.repository.split('/');
    if (parts.length !== 2) {
      core.warning(`Invalid repository format: ${this.repository}`);
    }
    return parts;
  }

  get data() {
    return {
      ...this._data,
      title: this.title,
      body: this.body,
      labels: this.labels,
      assignees: this.assignees,
      repository: this.repository,
      number: this.number,
      nwo: this.nwo,
    };
  }
}
