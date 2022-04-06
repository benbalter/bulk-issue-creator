# frozen_string_literal: true

RSpec.describe BulkIssueCreator::Project do
  subject(:project) { described_class.new(project_id) }

  let(:project_id) { 'project123' }
  let(:issue_id) { 'issue123' }

  it 'adds issues to the project' do
    url = 'https://api.github.com/graphql'
    body = {
      query: described_class::MUTATION,
      variables: {
        projectId: project_id,
        contentId: issue_id
      }
    }
    response = { id: 123 }.to_json
    request = stub_request(:post, url).with(body: body).to_return(
      status: 200, body: response, headers: { 'Content-Type' => 'application/json' }
    )

    project.add_issue(issue_id)
    expect(request).to have_been_made
  end
end
