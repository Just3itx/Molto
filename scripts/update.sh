#!/bin/bash

set -a
source .env
set +a

lune run scripts/build.luau "$@"
