# frozen_string_literal: true

RSpec.describe BulkIssueCreator do
  subject(:creator) { described_class.new(options) }

  let(:template_path) { nil }
  let(:csv_path) { nil }
  let(:write) { nil }
  let(:comment) { nil }
  let(:add_to_project) { nil }
  let(:options) do
    {
      template_path: template_path,
      csv_path: csv_path,
      write: write,
      comment: comment,
      add_to_project: add_to_project
    }
  end

  it 'uses the default template path' do
    expected = File.expand_path('../config/template.md.mustache', __dir__)
    expect(creator.template_path).to eql(expected)
  end

  context 'with template path' do
    let(:template_path) { File.expand_path('../config/other_template.md.mustache', __dir__) }

    it 'respects template path' do
      expect(creator.template_path).to eql(template_path)
    end
  end

  it 'uses the default CSV path' do
    expected = File.expand_path('../config/data.csv', __dir__)
    expect(creator.csv_path).to eql(expected)
  end

  context 'with CSV path' do
    let(:csv_path) { File.expand_path('../config/other_data.csv', __dir__) }

    it 'respects env CVV path' do
      expect(creator.csv_path).to eql(csv_path)
    end
  end

  it 'defaults to read only' do
    expect(creator).to be_read_only
  end

  context 'when writing' do
    let(:write) { true }

    it 'can write' do
      expect(creator).not_to be_read_only
    end
  end

  it 'defaults to issues' do
    expect(creator).not_to be_comment
  end

  context 'when commenting' do
    let(:comment) { true }

    it 'can comment' do
      expect(creator).to be_comment
    end
  end

  it 'inits the client' do
    expect(creator.send(:client)).to be_a(Octokit::Client)
  end

  it 'errors for missing path' do
    expect { creator.send(:ensure_path_exists, '_missing') }.to raise_error BulkIssueCreator::MissingFileError
  end

  context 'with fixtures' do
    let(:template_path) { fixture_path('template-with-front-matter.md.mustache') }
    let(:csv_path) { fixture_path('data.csv') }

    it 'reads the template' do
      expected = File.read(fixture_path('template.md.mustache'))
      expect(creator.template).to eql(expected)
    end

    it 'reads the data' do
      expected = CSV.table(fixture_path('data.csv')).to_a
      expect(creator.send(:table).to_a).to eql(expected)
    end

    it 'loads issues' do
      expect(creator.issues.first.title).to eql('Update GMan')
    end

    it "doesn't create issues by default" do
      stub_repo_request('benbalter/gman')
      stub_repo_request('benbalter/jekyll-auth')

      creator.run
      expect(a_request(:post, 'github.com')).not_to have_been_made
    end

    context 'when writing issues' do
      let(:write) { true }

      it 'creates issues' do
        gman_stub = stub_issue_request('benbalter/gman', 'GMan', %w[Red Blue])
        jekyll_auth_stub = stub_issue_request('benbalter/jekyll-auth', 'Jekyll Auth', %w[Green Blue])

        creator.run
        expect(gman_stub).to have_been_made
        expect(jekyll_auth_stub).to have_been_made
      end
    end

    context 'when adding to a project' do
      let(:write) { true }
      let(:add_to_project) { true }

      it 'adds issues to the project' do
        stub_issue_request('benbalter/gman', 'GMan', %w[Red Blue])
        stub_issue_request('benbalter/jekyll-auth', 'Jekyll Auth', %w[Green Blue])

        url = 'https://api.github.com/graphql'
        body = {
          query: described_class::Project::MUTATION,
          variables: {
            projectId: 'project123',
            contentId: 'issue123'
          }
        }
        response = { id: 123 }.to_json
        request = stub_request(:post, url).with(body: body).to_return(
          status: 200, body: response, headers: { 'Content-Type' => 'application/json' }
        )

        creator.run
        expect(request).to have_been_made
      end
    end

    context 'when passed write via ENV var' do
      it 'creates issues' do
        gman_stub = stub_issue_request('benbalter/gman', 'GMan', %w[Red Blue])
        jekyll_auth_stub = stub_issue_request('benbalter/jekyll-auth', 'Jekyll Auth', %w[Green Blue])

        with_env('WRITE', 'true') do
          creator.run
        end

        expect(gman_stub).to have_been_made
        expect(jekyll_auth_stub).to have_been_made
      end
    end

    context 'when writing comments' do
      let(:write) { true }
      let(:comment) { true }

      it 'creates comments' do
        gman_stub = stub_comment_request('benbalter/gman', 'GMan', 1)
        jekyll_auth_stub = stub_comment_request('benbalter/jekyll-auth', 'Jekyll Auth', 2)

        creator.run
        expect(gman_stub).to have_been_made
        expect(jekyll_auth_stub).to have_been_made
      end
    end

    it 'validates that repositories exist' do
      stub_repo_request('benbalter/gman')
      stub_repo_request('benbalter/jekyll-auth', 404)

      msg = 'Repository benbalter/jekyll-auth is invalid'
      expect { creator.run }.to raise_error BulkIssueCreator::InvalidRepoError, msg
    end
  end
end
