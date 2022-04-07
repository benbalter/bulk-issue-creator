#!/bin/bash

ARGS=""
if [ "$1" == "true" ]; then
  ARGS+="--write "
fi

if [ "$2" == "true" ]; then
  ARGS+="--comment "
fi

if [ ! -z "$3" ]; then
  ARGS+="--template-path=$3 "
fi

if [ ! -z "$4" ]; then
  ARGS+="--csv-path=$3 "
fi

cd $GITHUB_WORKSPACE
bundle exec ./bin/bulk-issue-creator create $ARGS