# frozen_string_literal: true

require 'net/http'

class BulkIssueCreator
  # Represents a row in the CSV to create/comment on an issue
  class Project
    ENDPOINT = URI('https://api.github.com/graphql')
    MUTATION = <<-'GRAPHQL'
      mutation($projectId: ID!, $contentId: ID!) {
        addProjectNextItem(input: {projectId: $projectId, contentId: $contentId}) {
          projectNextItem {
            id
          }
        }
      }
    GRAPHQL

    def initialize(node_id)
      @node_id = node_id
    end

    def add_issue(issue_id)
      Net::HTTP.start(ENDPOINT.hostname, ENDPOINT.port, use_ssl: true) do |http|
        req = Net::HTTP::Post.new(ENDPOINT)
        req['Content-Type'] = 'application/json'
        req['Authorization'] = "Bearer #{ENV['GITHUB_TOKEN']}"
        req.body = {
          query: MUTATION,
          variables: { contentId: issue_id, projectId: @node_id }
        }.to_json

        return http.request(req)
      end
    end
  end
end
