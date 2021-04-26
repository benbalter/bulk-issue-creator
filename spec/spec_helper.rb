# frozen_string_literal: true

require 'webmock/rspec'
WebMock.disable_net_connect!

RSpec.configure do |config|
  config.filter_run_when_matching :focus
  config.disable_monkey_patching!
  config.warnings = true
  config.default_formatter = 'doc' if config.files_to_run.one?
  config.order = :random
  Kernel.srand config.seed
end

require_relative '../lib/bulk_issue_creator'

def with_env(key, value)
  old_env = ENV[key]
  ENV[key] = value
  yield
  ENV[key] = old_env
end

def fixture_path(fixture)
  File.expand_path("./fixtures/#{fixture}", __dir__)
end

def stub_issue_request(nwo, name, labels)
  url = "https://api.github.com/repos/#{nwo}/issues"
  body = {
    title: "Update #{name}",
    body: "Hello #{name}!",
    labels: labels
  }
  response = { html_url: 'https://github.com/benbalter/bulk-issue-creator/issues/1' }.to_json
  stub_request(:post, url).with(body: body).to_return(
    status: 200,
    body: response,
    headers: { 'Content-Type' => 'application/json' }
  )
end

def stub_comment_request(nwo, name, number)
  url = "https://api.github.com/repos/#{nwo}/issues/#{number}/comments"
  body = { body: "Hello #{name}!" }
  response = { html_url: 'https://github.com/benbalter/bulk-issue-creator/issues/1#commment-1' }.to_json
  stub_request(:post, url).with(body: body).to_return(
    status: 200,
    body: response,
    headers: { 'Content-Type' => 'application/json' }
  )
end
