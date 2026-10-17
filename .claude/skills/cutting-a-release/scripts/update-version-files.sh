#!/usr/bin/env bash
# Writes a new version into every file that carries it.
set -euo pipefail

version=${1:?usage: update-version-files.sh <version>}
if [[ ! $version =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: '$version' is not a MAJOR.MINOR.PATCH version" >&2
  exit 1
fi

root=$(git rev-parse --show-toplevel)
cd "$root"

npm version "$version" --no-git-tag-version >/dev/null

chart=helm-chart/Chart.yaml
tmp=$(mktemp)
sed -E "s/^(version|appVersion): .*/\1: $version/" "$chart" >"$tmp"
mv "$tmp" "$chart"

git diff --stat -- package.json package-lock.json "$chart"
