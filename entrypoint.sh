#!/bin/sh

ARGS=""
if [ "$1" == "true" ]; then
  ARGS+="--write "
fi

if [ "$2" == "true" ]; then
  ARGS+="--comment "
fi

bundle exec ./bin/bulk-issue-creator create $ARGS