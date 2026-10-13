#!/bin/bash
# Validates every built font part (needs HarfBuzz's hb-shape) and the generated loader
set -e

for file in fonts/*/*.codepoints.json; do
	[ -e "$file" ] || continue
	dir=$(dirname "$file")
	id=$(basename "$dir")
	name=$(basename "$file" .codepoints.json)
	node scripts/test-font.mjs "$dir" "build/svg/$id" "$name"
done

lune run scripts/tests/test-loader.luau
