FROM ruby:2.7

COPY Gemfile ./
RUN bundle install

COPY lib/ /lib/
COPY script/run /script/run

ENTRYPOINT ["/script/run"]