# frozen_string_literal: true

RSpec.describe BulkIssueCreator do
  subject(:creator) { described_class }

  it 'uses the default template path' do
    expected = File.expand_path('../config/template.md.mustache', __dir__)
    expect(creator.template_path).to eql(expected)
  end

  it 'respects env template path' do
    expected = File.expand_path('../config/other_template.md.mustache', __dir__)
    with_env('TEMPLATE_PATH', expected) do
      expect(creator.template_path).to eql(expected)
    end
  end

  it 'uses the default CSV path' do
    expected = File.expand_path('../config/data.csv', __dir__)
    expect(creator.csv_path).to eql(expected)
  end

  it 'respects env CVV path' do
    expected = File.expand_path('../config/other_data.csv', __dir__)
    with_env('CSV_PATH', expected) do
      expect(creator.csv_path).to eql(expected)
    end
  end

  it 'defaults to read only' do
    expect(creator).to be_read_only
  end

  it 'can write' do
    with_env('WRITE', 'true') do
      expect(creator).not_to be_read_only
    end
  end

  it 'defaults to issues' do
    expect(creator).not_to be_comment
  end

  it 'can comment' do
    with_env('COMMENT', 'true') do
      expect(creator).to be_comment
    end
  end

  it 'inits the client' do
    expect(creator.client).to be_a(Octokit::Client)
  end

  it 'errors for missing path' do
    expect { creator.ensure_path_exists('_missing') }.to raise_error BulkIssueCreator::MissingFileError
  end

  context 'with fixtures' do
    it 'reads the template' do
      expected = File.read(fixture_path('template.md.mustache'))
      with_env('TEMPLATE_PATH', fixture_path('template.md.mustache')) do
        expect(creator.template).to eql(expected)
      end
    end

    it 'reads the data' do
      expected = CSV.table(fixture_path('data.csv')).to_a
      with_env('CSV_PATH', fixture_path('data.csv')) do
        expect(creator.table.to_a).to eql(expected)
      end
    end

    it 'loads issues' do
      with_env('TEMPLATE_PATH', fixture_path('template.md.mustache')) do
        with_env('CSV_PATH', fixture_path('data.csv')) do
          expect(creator.issues.first.title).to eql('Update GMan')
        end
      end
    end

    it "doesn't create issues by deafult" do
      with_env('TEMPLATE_PATH', fixture_path('template.md.mustache')) do
        with_env('CSV_PATH', fixture_path('data.csv')) do
          creator.run
          expect(a_request(:any, 'github.com')).not_to have_been_made
        end
      end
    end

    it 'creates issues' do
      gman_stub = stub_issue_request('benbalter/gman', 'GMan', %w[Red Blue])
      jekyll_auth_stub = stub_issue_request('benbalter/jekyll-auth', 'Jekyll Auth', %w[Green Blue])

      with_env('TEMPLATE_PATH', fixture_path('template.md.mustache')) do
        with_env('CSV_PATH', fixture_path('data.csv')) do
          with_env('WRITE', 'true') do
            creator.run
            expect(gman_stub).to have_been_made
            expect(jekyll_auth_stub).to have_been_made
          end
        end
      end
    end

    it 'creates comments' do
      gman_stub = stub_comment_request('benbalter/gman', 'GMan', 1)
      jekyll_auth_stub = stub_comment_request('benbalter/jekyll-auth', 'Jekyll Auth', 2)

      with_env('TEMPLATE_PATH', fixture_path('template.md.mustache')) do
        with_env('CSV_PATH', fixture_path('data.csv')) do
          with_env('WRITE', 'true') do
            with_env('COMMENT', 'true') do
              creator.run
              expect(gman_stub).to have_been_made
              expect(jekyll_auth_stub).to have_been_made
            end
          end
        end
      end
    end
  end
end
