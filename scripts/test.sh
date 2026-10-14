#!/bin/bash
# Validates every built font part (needs HarfBuzz's hb-shape) and the generated loader
set -e

for file in site/fonts/*/*.codepoints.json; do
	[ -e "$file" ] || continue
	dir=$(dirname "$file")
	id=$(basename "$dir")
	name=$(basename "$file" .codepoints.json)
	node scripts/test-font.mjs "$dir" "build/svg/$id" "$name"
done

# Icons must be white: dark sprites are invisible once tinted. The negate step turns every pixel's RGB to white,
# so any sheet with unprocessed icons has a mean red value below 1
for sheet in site/spritesheets/*/*.png; do
	mean=$(magick "$sheet" -format "%[fx:mean.r]" info:)
	if ! awk "BEGIN { exit !($mean > 0.99) }"; then
		echo "Spritesheet has icons that were not inverted to white: $sheet (mean red $mean)"
		exit 1
	fi
done
echo "Spritesheets are white on transparent"

lune run scripts/tests/test-loader.luau
