# frozen_string_literal: true

require_relative 'lib/bulk_issue_creator/version'

Gem::Specification.new do |spec|
  spec.name          = 'bulk_issue_creator'
  spec.version       = BulkIssueCreator::VERSION
  spec.authors       = ['Ben Balter']
  spec.email         = ['ben@balter.com']

  spec.summary       = 'Bulk Issue Creator'
  spec.description   = 'Bulk opens batches of issues (or posts comments) across GitHub repositories based on a template and CSV of values.'
  spec.homepage      = 'https://github.com/benbalter/bulk-issue-creator'
  spec.license       = 'MIT'
  spec.required_ruby_version = '>= 2.5.0'

  spec.metadata['homepage_uri'] = spec.homepage
  spec.metadata['source_code_uri'] = spec.homepage

  # Specify which files should be added to the gem when it is released.
  # The `git ls-files -z` loads the files in the RubyGem that have been added into git.
  spec.files = Dir.chdir(File.expand_path(__dir__)) do
    `git ls-files -z`.split("\x0").reject { |f| f.match(%r{\A(?:test|spec|features)/}) }
  end
  spec.bindir        = 'bin'
  spec.executables   = spec.files.grep(%r{\Abin/}) { |f| File.basename(f) }
  spec.require_paths = ['lib']

  spec.add_dependency 'activesupport'
  spec.add_dependency 'dotenv'
  spec.add_dependency 'faraday-http-cache'
  spec.add_dependency 'mustache'
  spec.add_dependency 'octokit'
  spec.add_dependency 'retryable'
  spec.add_dependency 'thor'

  spec.add_development_dependency 'pry'
  spec.add_development_dependency 'rspec'
  spec.add_development_dependency 'rubocop'
  spec.add_development_dependency 'rubocop-performance'
  spec.add_development_dependency 'rubocop-rspec'
  spec.add_development_dependency 'webmock'
  spec.metadata['rubygems_mfa_required'] = 'true'
end
