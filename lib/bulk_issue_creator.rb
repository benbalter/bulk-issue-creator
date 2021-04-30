# frozen_string_literal: true

require 'octokit'
require 'dotenv/load'
require 'mustache'
require 'csv'
require 'yaml'
require 'active_support/core_ext/hash/keys'
require_relative './bulk_issue_creator/issue'

# Bulk opens batches of issues across GitHub repositories based on a template and CSV of values
module BulkIssueCreator
  class MissingFileError < ArgumentError; end

  class InvalidRepoError < ArgumentError; end

  class << self
    def template_path
      ENV['TEMPLATE_PATH'] || File.expand_path('./config/template.md.mustache', Dir.pwd)
    end

    def csv_path
      ENV['CSV_PATH'] || File.expand_path('./config/data.csv', Dir.pwd)
    end

    def read_only?
      ENV['WRITE'] != 'true'
    end

    def comment?
      ENV['COMMENT'] == 'true'
    end

    def client
      @client ||= Octokit::Client.new(access_token: ENV['GITHUB_TOKEN'])
    end

    def template
      @template = File.read(template_path)
    end

    def table
      @table ||= CSV.table(csv_path)
    end

    def issues
      @issues ||= table.map { |row| BulkIssueCreator::Issue.new(row.to_h, template) }
    end

    def ensure_path_exists(path)
      raise MissingFileError, "Expected #{path} to exist" unless File.exist?(path)
    end

    def preview_output
      puts 'Running in read-only mode. Pass `WRITE=true` environmental variable to create issues.'
      puts "The following #{comment? ? 'comments' : 'issues'} would be created:\n\n"

      issues.each do |issue|
        unless client.repository?(issue.repository.strip)
          raise InvalidRepoError, "Repository #{issue.repository.strip} is invalid"
        end

        puts YAML.dump(issue.to_h.stringify_keys)
      end
    end

    def create_issues
      issues.each do |issue|
        result = client.create_issue(issue.repository.strip, issue.title, issue.body, { labels: issue.labels })
        puts "Created #{result.html_url}"
      end
    end

    def create_comments
      issues.each do |issue|
        result = client.add_comment(issue.repository.strip, issue.issue_number, issue.body)
        puts "Created #{result.html_url}"
      end
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
  end
end
