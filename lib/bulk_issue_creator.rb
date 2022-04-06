# frozen_string_literal: true

require 'active_support/core_ext/hash/keys'
require 'csv'
require 'dotenv/load'
require 'logger'
require 'mustache'
require 'octokit'
require 'retryable'
require 'yaml'
require 'faraday-http-cache'

# Bulk opens batches of issues across GitHub repositories based on a template and CSV of values
class BulkIssueCreator
  class MissingFileError < ArgumentError; end
  class InvalidRepoError < ArgumentError; end

  autoload :Project, 'bulk_issue_creator/project'
  autoload :Issue, 'bulk_issue_creator/issue'
  autoload :VERSION, 'bulk_issue_creator/version'

  OPTIONS = %i[template_path csv_path write comment add_to_project project_id].freeze

  def initialize(options = {})
    OPTIONS.each do |option|
      instance_variable_set("@#{option}", options[option]) if options[option]
    end
    
    @github_token = ENV['GITHUB_TOKEN']
  end

  def template_path
    @template_path ||= File.expand_path('./config/template.md.mustache', Dir.pwd)
  end

  def csv_path
    @csv_path ||= File.expand_path('./config/data.csv', Dir.pwd)
  end

  def read_only?
    @write != true && @write != 'true'
  end

  def comment?
    @comment == true
  end

  def add_to_project?
    @add_to_project == true
  end

  def template
    @template ||= File.read(template_path)
  end

  def issues
    @issues ||= table.map { |row| BulkIssueCreator::Issue.new(row.to_h, template) }
  end

  def run
    ensure_path_exists(csv_path)
    ensure_path_exists(template_path)
    return preview_output if read_only?

    if comment?
      create_comments
    else
      create_issues
    end
  end

  private

  def create_issues
    issues.each do |issue|
      options = { labels: issue.labels, assignees: issue.assignees }
      result = Retryable.retryable(**retriable_options) do
        client.create_issue(issue.repository, issue.title, issue.body, options)
      end
      logger.info "Created #{result.html_url}"

      add_to_project(result.node_id, issue.project_id) if add_to_project?
    end
  end

  def add_to_project(content_id, project_id = nil)
    project_id ||= @project_id
    return unless project_id

    project = Project.new(project_id)
    Retryable.retryable(**retriable_options) do
      project.add_issue(content_id)
    end
    logger.info "Added #{content_id} to project #{project_id}"
  end

  def create_comments
    issues.each do |issue|
      result = Retryable.retryable(**retriable_options) do
        client.add_comment(issue.repository, issue.issue_number, issue.body)
      end
      logger.info "Created #{result.html_url}"
    end
  end

  def client
    @client ||= Octokit::Client.new(access_token: @github_token, middlware: octokit_middleware)
  end

  def table
    @table ||= CSV.table(csv_path)
  end

  def ensure_path_exists(path)
    raise MissingFileError, "Expected #{path} to exist" unless File.exist?(path)
  end

  def preview_output
    logger.info 'Running in read-only mode. Pass `WRITE=true` environmental variable to create issues.'
    logger.info "The following #{comment? ? 'comments' : 'issues'} would be created:\n\n"

    issues.each do |issue|
      unless client.repository?(issue.repository)
        raise InvalidRepoError, "Repository #{issue.repository} is invalid"
      end

      logger.info YAML.dump(issue.to_h.stringify_keys)
    end
  end

  def logger
    @logger ||= Logger.new($stdout)
  end

  def logger_method
    @logger_method ||= lambda do |retries, exception|
      logger.warn("[Attempt ##{retries}] Retrying because [#{exception.class} - #{exception.message}]")
    end
  end

  def retriable_options
    @retriable_options ||= {
      tries: 5,
      sleep: ->(n) { 4**n },
      log_method: logger_method
    }
  end

  def octokit_middleware
    @octokit_middleware ||= Faraday::RackBuilder.new do |builder|
      builder.use Faraday::HttpCache, serializer: Marshal, shared_cache: false
      builder.use Octokit::Response::RaiseError
      builder.adapter Faraday.default_adapter
    end
  end
end
