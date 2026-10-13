#!/bin/bash
# Validates every built font (needs HarfBuzz's hb-shape) and the generated loader
set -e

for dir in fonts/*/; do
	id=$(basename "$dir")
	node scripts/test-font.mjs "fonts/$id" "build/svg/$id" "$id"
done

lune run scripts/tests/test-loader.luau
