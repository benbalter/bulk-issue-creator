import mustache from 'mustache';
import { Liquid } from 'liquidjs';
import * as core from '@actions/core';

// Issues are Markdown, not HTML, so don't HTML-escape rendered values
const mustacheConfig = { escape: (value: string) => value };
const liquid = new Liquid();

export interface IssueData {
  title: string;
  labels?: string;
  assignees?: string;
  assignee?: string;
  repository?: string;
  issue_number?: string;
  [key: string]: string | undefined;
}

function splitList(list: string | undefined): string[] {
  if (!list) {
    return [];
  }
  return list
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
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
    // Comment CSVs don't need a title column, and mustache throws on undefined
    if (!this._data.title) {
      return '';
    }
    return mustache.render(
      this._data.title,
      this._data,
      undefined,
      mustacheConfig,
    );
  }

  get body() {
    if (this.liquid === true) {
      return liquid.parseAndRenderSync(this.template, this._data);
    }
    return mustache.render(
      this.template,
      this._data,
      undefined,
      mustacheConfig,
    );
  }

  get labels() {
    return splitList(this._data.labels);
  }

  get assignees() {
    return splitList(this._data.assignees || this._data.assignee).map(
      (assignee) => assignee.replace('@', ''),
    );
  }

  get repository(): string {
    if (!this._data.repository) {
      core.warning(
        'Repository not found in row: ' + JSON.stringify(this._data),
      );
      return '';
    }
    // Accept full URLs from any forge, e.g. https://gitlab.com/group/project.git
    return this._data.repository
      .trim()
      .replace(/^https?:\/\/[^/]+\//, '')
      .replace(/\.git$/, '')
      .replace(/\/+$/, '');
  }

  get number() {
    return Number(this._data.issue_number);
  }

  get nwo(): string[] {
    return this.repository.split('/');
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
