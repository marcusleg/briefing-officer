# Report: the cleanup workflow deleted every container image

- **Date:** 2026-07-25
- **Status:** mitigated — workflow deleted; image **not yet republished**
- **Impact:** all 350 versions of `ghcr.io/marcusleg/briefing-officer` gone,
  including every release tag. History unrecoverable.

## What happened

`cleanup-container-images.yaml` (added `97eca79`, 2026-07-03) ran four times and
emptied the package. It did not malfunction — it did what its config asked.

| Started (UTC)    | Trigger             | Deleted |
| ---------------- | ------------------- | ------- |
| 2026-07-03 11:56 | `workflow_dispatch` | 100     |
| 2026-07-05 21:18 | `schedule`          | 100     |
| 2026-07-12 21:05 | `schedule`          | 100     |
| 2026-07-19 21:06 | `schedule`          | 50      |

All four reported success. Nothing noticed for 21 days.

## Why the tag allowlist never worked

```yaml
min-versions-to-keep: 0
ignore-versions: '^(latest|unstable|\d+\.\d+\.\d+)$'
```

`ignore-versions` is tested against a version's `name`. For a container package
the name is the **manifest digest**, not the tag:

```text
name:     sha256:6cb04d8c51cee0376c3685f987783d61ac44e04e6cb9d97563c38309528a97c3
metadata:
  container:
    tags: ["unstable"]     <- the tags are here, and are never consulted
```

`^(latest|unstable|\d+\.\d+\.\d+)$` cannot match a string starting `sha256:`, so
the allowlist matched zero versions and protected nothing. An allowlist matching
nothing behaves exactly like one that was never set — no warning, run still
green.

Confirmed in the source: `src/delete.ts:77` filters on `info.version`, and
`src/version/get-versions.ts:71` sets that field to `version.name`. The action
does read the tags, but only to set a `tagged` boolean that `ignore-versions`
never consults.

**Not a typo.** The same regex works correctly on npm, NuGet or Maven packages,
where a version's name really is `1.2.3`. Containers are the exception.

`min-versions-to-keep: 0` then removed the floor: it reads as "impose no
minimum", but the action documents `0` as _delete all versions_ (default `-1`).

## Why it took four runs

Neither input explains the count of 100. That is a hardcoded `RATE_LIMIT = 100`
(`src/delete.ts:12`), applied as `min(remaining, 100)` and sliced off the front
of a list sorted **oldest-first** (`src/delete.ts:65-70,96`): ~350 → 250 → 150 →
50 → 0.

The tags survived the first three runs by being the _newest_ versions, not
because anything republished them — the last build ran 07-11, a day before the
third purge, which still left a working `:unstable` for another week. The 07-19
run was simply the first where fewer than 100 versions remained.

## Decision: images are never cleaned up

**Published container images are kept indefinitely. There is no cleanup workflow
and no retention policy, and there is not going to be one.** That includes the
untagged digests orphaned by each push to `main`.

GHCR storage is free for public packages, so retention costs nothing. The
workflow was buying tidiness with a resource we are not billed for, and it cost
us the package. We are not going out of our way to save GitHub disk space using
a tool that is misleading about which field it matches and lacks the
functionality to do the job safely.

Both ways of keeping a cleanup step carry ongoing risk.

**Fix the inputs** (`delete-only-untagged-versions: true` + nonzero
`min-versions-to-keep`) works only because the build uses the default `docker`
driver — one plain manifest per tag, no children. Adding
`docker/setup-buildx-action` switches to `docker-container`, which for a public
repo attaches `mode=max` provenance and publishes a manifest list. One tag then
becomes three versions, two of them untagged children:

| Version               | Tags           | Seen as                |
| --------------------- | -------------- | ---------------------- |
| index (manifest list) | `["unstable"]` | tagged → protected     |
| platform manifest     | `[]`           | untagged → **deleted** |
| attestation manifest  | `[]`           | untagged → **deleted** |

Deleting the children leaves the tag resolving in the UI while `docker pull`
fails with `manifest unknown`. No configuration of that action is safe against
manifest lists: it never contacts the registry, so it cannot know one digest is
a child of another.

**Replace with `dataaxiom/ghcr-cleanup-action`** is genuinely correct — its
`exclude-tags` matches real tags and it resolves manifests. But it grants
`packages: write` to a third-party action to solve a problem we do not have.

So untagged versions now accumulate, at roughly a few hundred a year, of an
artifact that costs nothing to store. That is the accepted trade.

## Open items

| #   | Item                                               | Status   |
| --- | -------------------------------------------------- | -------- |
| 1   | Delete `cleanup-container-images.yaml`             | done     |
| 2   | Add `workflow_dispatch:` to `container-image.yaml` | done     |
| 3   | Republish the image                                | **open** |
| 4   | Assert the package is non-empty after publish      | **open** |
| 5   | Review the package's "Manage Actions access" grant | **open** |

**3** — deleted digests are not reproducible, so a rebuild restores `:unstable`
under a **new** digest. Anything pinned to a specific digest needs updating.

**4** — would have caught this on 07-19 instead of 07-24:

```yaml
- name: Assert package is not empty
  run: |
    count=$(gh api /user/packages/container/briefing-officer/versions --jq 'length')
    [ "$count" -gt 0 ] || { echo "::error::package has zero versions"; exit 1; }
```

**5** — the deleted workflow required granting this repo the Admin role in the
package's Actions access settings. That grant was made by hand and is **not**
removed by deleting the workflow; every workflow here still holds it.

## If this is ever revisited

The decision above stands unless someone has a concrete reason beyond tidiness.
If that happens:

- Do not use `actions/delete-package-versions` on a container package.
- Protect tags with an input documented as matching **tags**, not version names.
- Dry-run first; pin third-party actions to a commit SHA.
- Alert on the package version count, not on workflow success — a cleanup
  workflow reports success precisely when it deletes things.

## Blast radius

`package-name: "briefing-officer"` scoped the workflow to this package alone. A
sweep of every workflow file across the account found this configuration nowhere
else.
