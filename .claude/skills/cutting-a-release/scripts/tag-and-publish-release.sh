#!/usr/bin/env bash
# Tags the merged release commit on main and creates the GitHub release from
# its CHANGELOG.md section. Pushing the tag triggers the container image and
# Helm chart workflows.
set -euo pipefail

version=${1:?usage: tag-and-publish-release.sh <version>}
tag="v$version"

git fetch --quiet --tags origin main

if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
  echo "error: tag $tag already exists" >&2
  exit 1
fi

commit=$(git log origin/main --format=%H --fixed-strings \
  --grep="chore: release $version" -1)
if [[ -z $commit ]]; then
  echo "error: no 'chore: release $version' commit on origin/main; is the release PR merged?" >&2
  exit 1
fi

pkg_version=$(git show "$commit:package.json" | node -p 'JSON.parse(require("fs").readFileSync(0)).version')
if [[ $pkg_version != "$version" ]]; then
  echo "error: package.json at ${commit:0:7} has version $pkg_version, expected $version" >&2
  exit 1
fi

# The section body: everything between this version's heading and the next one.
notes=$(git show "$commit:CHANGELOG.md" | awk -v v="$version" '
  /^## / { if (found) exit; if (index($0, "## [" v "]") == 1) { found = 1; next } }
  found { print }
')
if [[ -z ${notes//[[:space:]]/} ]]; then
  echo "error: CHANGELOG.md at ${commit:0:7} has no section for $version" >&2
  exit 1
fi

git tag -a "$tag" -m "$tag" "$commit"
git push origin "$tag"
gh release create "$tag" --verify-tag --latest --title "$tag" --notes "$notes"
