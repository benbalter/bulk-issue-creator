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

  autoload :Issue, 'bulk_issue_creator/issue'
  autoload :VERSION, 'bulk_issue_creator/version'

  OPTION_KEYS = %i[template_path csv_path write comment github_token].freeze
  BOOL_OPTIONS = %i[write comment].freeze
  DEFAULT_TEMPLATE_PATH = './config/template.md.mustache'
  DEFAULT_CSV_PATH = './config/data.csv'
  YAML_FRONT_MATTER_REGEXP = /\A(---\s*\n.*?\n?)^((---|\.\.\.)\s*$\n?)/m.freeze

  def initialize(passed_options = {})
    @options = {}

    OPTION_KEYS.each do |key|
      value = passed_options[key] || ENV.fetch(key.to_s.upcase, nil)
      @options[key] = BOOL_OPTIONS.include?(key) ? truthy?(value) : value
    end
  end

  def template_path
    @options[:template_path] ||= File.expand_path(DEFAULT_TEMPLATE_PATH, Dir.pwd)
  end

  def csv_path
    @options[:csv_path] ||= File.expand_path(DEFAULT_CSV_PATH, Dir.pwd)
  end

  def read_only?
    !@options[:write]
  end

  def comment?
    @options[:comment]
  end

  def template
    @template ||= File.read(template_path).to_s.split(YAML_FRONT_MATTER_REGEXP).last.to_s
  end

  def issues
    @issues ||= table.map { |row| BulkIssueCreator::Issue.new(row.to_h, template) }
  end

  def run
    logger.info "Running with the following options:\n#{options_preview}"

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
    end
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
    @client ||= Octokit::Client.new(access_token: @options[:github_token], middlware: octokit_middleware)
  end

  def table
    @table ||= CSV.table(csv_path)
  end

  def ensure_path_exists(path)
    raise MissingFileError, "Expected #{path} to exist" unless File.exist?(path)
  end

  def preview_output
    logger.info 'Running in READ ONLY mode. Pass `WRITE=true` environmental variable to create issues.'
    logger.info "The following #{comment? ? 'comments' : 'issues'} would be created:\n\n"

    issues.each do |issue|
      repo_exists?(issue.repository)
      logger.info YAML.dump(issue.to_h.stringify_keys, line_width: -1)
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

  def repo_exists?(repo)
    unless client.repository?(repo)
      raise InvalidRepoError, "Repository #{repo} is invalid"
    end
  rescue Octokit::Unauthorized => e
    logger.warn "Unable to check if repository #{repo} is valid: #{e.message}"
  end

  def truthy?(value)
    value.to_s.casecmp('true').zero?
  end

  def options_preview
    options = @options.reject { |k, _v| k == :github_token }
    YAML.dump(options.stringify_keys)
  end
end
