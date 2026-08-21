#!/usr/bin/env sh
# Build the static site into dist/.
#
# Used as the Cloudflare Pages build command, and runnable locally (Git Bash on
# Windows) to preview exactly what will be deployed:
#
#     sh scripts/build-site.sh && python -m http.server -d dist 8080
#
# site/index.html points its <img> at the diagram on GitHub, so that opening it
# directly in a browser previews correctly without running this script. The
# build swaps that URL for a local copy under a content-hashed filename.
# Combined with the immutable Cache-Control in site/_headers, that means:
#   - unchanged diagram -> same filename -> browsers never re-fetch it
#   - changed diagram   -> new filename  -> picked up on the next page load
set -eu

SRC_SVG="keymap-drawer/corne.svg"
SRC_DIR="site"
OUT_DIR="dist"

# Must match the <img src> committed in site/index.html.
REMOTE_SVG="https://raw.githubusercontent.com/sterrenb/zmk-config/main/keymap-drawer/corne.svg"

[ -f "$SRC_SVG" ] || { echo "error: $SRC_SVG not found (run from the repo root)" >&2; exit 1; }
[ -f "$SRC_DIR/index.html" ] || { echo "error: $SRC_DIR/index.html not found" >&2; exit 1; }

grep -q "$REMOTE_SVG" "$SRC_DIR/index.html" || {
  echo "error: $SRC_DIR/index.html does not reference $REMOTE_SVG" >&2
  echo "       REMOTE_SVG in this script and the <img src> must be kept in sync." >&2
  exit 1
}

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR/assets"

# Hash the file contents, not the commit: a push that does not touch the diagram
# must not invalidate it.
hash=$(sha256sum "$SRC_SVG" | cut -c1-12)
asset="assets/keymap.$hash.svg"

cp "$SRC_SVG" "$OUT_DIR/$asset"

# Match the URL literally. Only '.' needs escaping here: the substitution below
# uses '|' as its delimiter so '/' is safe, and the other BRE metacharacters
# ('*', '[', '^', '$') do not occur in a URL of this shape.
remote_re=$(printf '%s' "$REMOTE_SVG" | sed 's/\./\\./g')
sed "s|$remote_re|$asset|g" "$SRC_DIR/index.html" > "$OUT_DIR/index.html"

[ -f "$SRC_DIR/_headers" ] && cp "$SRC_DIR/_headers" "$OUT_DIR/_headers"

# The remote URL is a working image, so an unsubstituted page would look fine
# while silently hotlinking GitHub and losing the immutable caching. Check both
# directions rather than trusting sed.
if grep -q "$REMOTE_SVG" "$OUT_DIR/index.html"; then
  echo "error: the remote diagram URL was not replaced in $OUT_DIR/index.html" >&2
  exit 1
fi
if ! grep -q "$asset" "$OUT_DIR/index.html"; then
  echo "error: $asset is not referenced by $OUT_DIR/index.html" >&2
  exit 1
fi

echo "built $OUT_DIR/ -> $asset"
