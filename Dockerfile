FROM ruby:2.7

ENV GITHUB_WORKSPACE=/usr/src/app
WORKDIR $GITHUB_WORKSPACE

COPY Gemfile ./
COPY lib/bulk_issue_creator/version.rb lib/bulk_issue_creator/version.rb
COPY bulk_issue_creator.gemspec ./
RUN bundle install

COPY entrypoint.sh /entrypoint.sh
COPY bin/ bin/
COPY lib/ lib/

ENTRYPOINT ["/entrypoint.sh"]
