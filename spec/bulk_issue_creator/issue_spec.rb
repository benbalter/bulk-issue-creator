# frozen_string_literal: true

RSpec.describe BulkIssueCreator::Issue do
  subject(:issue) { described_class.new(data, template) }

  let(:data) { { title: 'Update {{project}}', project: 'Test', repository: 'foo/bar' } }
  let(:template) { File.read fixture_path('template.md.mustache') }
  let(:assignees) { [] }
  let(:hash) do
    {
      assignees: assignees,
      title: 'Update Test',
      project: 'Test',
      body: 'Hello Test!',
      repository: 'foo/bar'
    }
  end

  it 'renders the title' do
    expect(issue.title).to eql('Update Test')
  end

  it 'renders the body' do
    expect(issue.body).to eql('Hello Test!')
  end

  it 'returns fields' do
    expect(issue.project).to eql('Test')
  end

  it 'knows when fields are missing' do
    expect { issue.foo }.to raise_error NoMethodError
  end

  it 'returns a hash' do
    expect(issue.to_h).to eql(hash)
  end

  it 'doesnt err with no labels' do
    expect(issue.labels).to be_nil
  end

  it 'returns assignees' do
    expect(issue.assignees).to eql(assignees)
  end

  context 'with assignees' do
    let(:data) { { title: 'Update {{project}}', project: 'Test', repository: 'foo/bar', assignees: 'foo, bar' } }

    it 'returns assignees' do
      expect(issue.assignees).to eql(%w[foo bar])
    end
  end

  context 'with labels' do
    let(:data) { { title: 'Update {{project}}', project: 'Test', repository: 'foo/bar', labels: 'foo' } }

    it 'returns assignees' do
      expect(issue.labels).to eql('foo')
    end
  end
end
