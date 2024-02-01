FROM ruby:3.3.0

ENV SCRIPT_PATH=/usr/src/app
WORKDIR $SCRIPT_PATH

COPY Gemfile ./
COPY lib/bulk_issue_creator/version.rb lib/bulk_issue_creator/version.rb
COPY bulk_issue_creator.gemspec ./
RUN bundle install

COPY entrypoint.sh entrypoint.sh
COPY bin/ bin/
COPY lib/ lib/

ENTRYPOINT ["sh", "-c", "$SCRIPT_PATH/entrypoint.sh"]
