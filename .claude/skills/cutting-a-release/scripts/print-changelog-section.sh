#!/usr/bin/env bash
# Prints a version's CHANGELOG.md section without its heading, as GitHub should
# show it in a PR description or release notes. GitHub renders every line break
# there, so wrapped bullets are joined back into single lines.
set -euo pipefail

version=${1:?usage: print-changelog-section.sh <version> [<commit>]}
commit=${2:-HEAD}

notes=$(git show "$commit:CHANGELOG.md" | awk -v v="$version" '
  /^## / { if (found) exit; if (index($0, "## [" v "]") == 1) { found = 1; next } }
  found { print }
' | awk '
  /^ +[^ ]/ && prev != "" { sub(/^ +/, ""); prev = prev " " $0; next }
  { if (NR > 1) print prev; prev = $0 }
  END { print prev }
')
if [[ -z ${notes//[[:space:]]/} ]]; then
  echo "error: CHANGELOG.md at $(git rev-parse --short "$commit") has no section for $version" >&2
  exit 1
fi

printf '%s\n' "$notes"
