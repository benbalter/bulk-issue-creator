#!/usr/bin/env ruby
# frozen_string_literal: true

require 'octokit'
require 'dotenv/load'
require 'mustache'
require 'csv'

template_path = ENV['TEMPLATE_PATH'] || './config/template.md.mustache'
csv_path = ENV['CSV_PATH'] || './config/data.csv'
read_only = ENV['WRITE'] != 'true'
comment = ENV['comment'] == 'true'

unless File.exist?(csv_path)
  puts "Expected to find a CSV at #{csv_path}. Please create one."
  exit 1
end

unless File.exist?(template_path)
  puts "Expected to find a Mustache template at #{template_path}. Please create one."
  exit 1
end

client = Octokit::Client.new(access_token: ENV['GITHUB_TOKEN'])
template = File.read(template_path)
issues = CSV.table(csv_path)

if read_only
  puts 'Running in read-only mode. Pass `WRITE=true` environmental variable to create issues.'
  puts "The following #{comment ? 'comments' : 'issues'} would be created:\n\n"
end

issues.each do |issue|
  repository = issue[:repository]
  title = Mustache.render(issue[:title], issue)
  labels = issue[:labels]
  issue_number = issue[:issue_number]
  body = Mustache.render(template, issue)

  if read_only
    puts '---'
    puts "Repository: #{repository}"
    puts "Title: #{title}"
    puts "Labels: #{labels}"
    puts "Issue number: #{issue_number}"
    puts "Body: \n\n#{body}"
    puts "---\n\n"
  else
    result = if comment
               client.add_comment(repository, issue_number, body)
             else
               client.create_issue(repository, title, body, { labels: labels })
             end

    puts "Created #{result.html_url}"
    sleep 1
  end
end
