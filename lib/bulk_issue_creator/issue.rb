# frozen_string_literal: true

class BulkIssueCreator
  # Represents a row in the CSV to create/comment on an issue
  class Issue
    attr_reader :data, :template

    def initialize(data, template)
      @data = data
      @template = template
    end

    def body
      puts template.inspect
      Mustache.render(template, data)
    end

    def title
      Mustache.render(data[:title].to_s, data).strip
    end

    def labels
      @data[:labels]
    end

    def assignees
      @data[:assignees] ? @data[:assignees].split(',').map(&:strip) : []
    end

    def repository
      @data[:repository]&.strip
    end

    def method_missing(meth, *arguments, &block)
      return data[meth] if data.key?(meth)

      super
    end

    def respond_to_missing?(meth, include_private = false)
      data.key?(meth) || super
    end

    def to_h
      data.merge({
                   title: title,
                   body: body,
                   repository: repository,
                   assignees: assignees
                 })
    end
  end
end
