#!/usr/bin/env bash
# Lists everything on origin/main since the last release tag, together with
# the PR and issue numbers behind each commit, and computes the next version
# from the Conventional Commit types.
set -euo pipefail

git fetch --quiet --tags origin main

last_tag=$(git describe --tags --abbrev=0 --match 'v[0-9]*' origin/main)
current=${last_tag#v}
IFS=. read -r major minor patch <<<"$current"

bump=none
reason="no feat, fix, perf or breaking commits"
declare -A pr_issues=()

echo "Last release: $last_tag ($(git log -1 --format=%as "$last_tag"))"
echo
echo "Commits since $last_tag (oldest first):"

while read -r sha; do
  subject=$(git log -1 --format=%s "$sha")
  body=$(git log -1 --format=%b "$sha")
  type=$(sed -nE 's/^([a-z]+)(\([^)]*\))?(!)?:.*/\1\3/p' <<<"$subject")

  if [[ $type == *! ]] || grep -qE '^BREAKING[ -]CHANGE:' <<<"$body"; then
    bump=breaking
    reason="breaking change in ${sha:0:7}"
  elif [[ $type == feat && $bump != breaking ]]; then
    bump=minor
    reason="feat commits"
  elif [[ $type =~ ^(fix|perf)$ && $bump == none ]]; then
    bump=patch
    reason="fix or perf commits"
  fi

  pr=$(gh api "repos/{owner}/{repo}/commits/$sha/pulls" --jq '.[0].number // empty')
  issues=$(grep -oiE '(close[sd]?|fix(e[sd])?|resolve[sd]?|refs?) #[0-9]+' <<<"$body" |
    grep -oE '[0-9]+' || true)
  if [[ -n $pr ]]; then
    if [[ -z ${pr_issues[$pr]+set} ]]; then
      pr_issues[$pr]=$(gh pr view "$pr" --json closingIssuesReferences \
        --jq '.closingIssuesReferences[].number')
    fi
    issues=$(printf '%s\n%s\n' "$issues" "${pr_issues[$pr]}")
  fi
  issues=$(grep -v '^$' <<<"$issues" | sort -un | sed 's/^/#/' | paste -sd' ' || true)

  line="${sha:0:7} $subject"
  [[ -n $pr ]] && line+="  [PR #$pr]"
  [[ -n $issues ]] && line+="  [issues $issues]"
  echo "$line"
done < <(git rev-list --reverse "$last_tag..origin/main")

# Before 1.0, breaking changes bump the minor version.
case $bump in
  breaking)
    if ((major == 0)); then next="0.$((minor + 1)).0"; else next="$((major + 1)).0.0"; fi
    ;;
  minor) next="$major.$((minor + 1)).0" ;;
  patch) next="$major.$minor.$((patch + 1))" ;;
  none) next="" ;;
esac

echo
if [[ -n $next ]]; then
  echo "Next version: $next ($reason)"
else
  echo "Next version: none ($reason)"
fi
