FROM ruby:2.7

COPY Gemfile ./
COPY bulk_issue_creator.gemspec ./
RUN bundle install

COPY bin/ /bin/
COPY lib/ /lib/
COPY script/run /script/run

ENTRYPOINT ["/bin/bulk-issue-creator"]