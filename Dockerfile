FROM ruby:2.7

COPY Gemfile ./
RUN bundle install

COPY bulk-issue-creator.rb /bulk-issue-creator.rb

ENTRYPOINT ["/bulk-issue-creator.rb"]