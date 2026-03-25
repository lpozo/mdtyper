#!/usr/bin/env bash
set -euo pipefail
# Build the MdTyper extension.
# Options: --production (minify, no sourcemaps), --watch (incremental rebuilds)
node scripts/esbuild.mjs "$@"
