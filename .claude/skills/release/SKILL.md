---
name: release
description: Release a new version of the app (bump the version in pyproject.toml and uv.lock, commit „Release X.Y.Z“, tag vX.Y.Z, push). Use when the organizer asks for a release or a new version. Never deploys to production.
---

# Release a version

A release is a version bump, a commit and a tag. It is what `/api/health` reports as `version`. **It never touches production** (votypka.sk): deploying is the separate `deploy-prod` skill, and only when the organizer asks for that deploy (CLAUDE.md, "Production").

PATH: `uv` and `node` live in `/opt/homebrew/bin` (`export PATH="/opt/homebrew/bin:$PATH"`).

## 1. Pre-flight

- `git fetch origin`, then `git status -sb`: `main` must be level with `origin/main`. Uncommitted changes that belong to the release (finished try-outs or tasks) are committed first, each in its own commit as usual; anything else (e.g. untracked local files) stays out. If unsure what a change is, ask.
- The board has nothing in `tasks/in-progress/`, `tasks/review/` or `tasks/testing/`. If it does, tell the organizer and ask whether to release anyway.
- `uv run pytest -q` and `node --test tests/js/` pass. If anything fails, stop and report the failure; do not release.

## 2. Pick the version

- The current version is `[project].version` in `pyproject.toml`; the last tag is `git describe --tags --abbrev=0`.
- List what changed: `git log --oneline <last tag>..HEAD`. Nothing since the last tag: tell the organizer, there is nothing to release.
- Use the version the organizer asked for. Otherwise: **minor** (`1.7.0` → `1.8.0`) when anything new is visible on the page or in the API, **patch** (`1.7.0` → `1.7.1`) for fixes and tweaks only. Say which you chose and why.
- The tag `vX.Y.Z` must not exist yet (`git tag -l vX.Y.Z`, `git ls-remote --tags origin vX.Y.Z`).

## 3. Bump, commit, tag, push

1. Set `version = "X.Y.Z"` in `pyproject.toml`.
2. `uv lock`, which updates the `chrapa-poll` entry in `uv.lock`. Then `uv lock --check` must pass.
3. `git diff --stat` shows exactly `pyproject.toml` and `uv.lock`, one line changed in each. If `uv lock` changed other packages, stop: revert it and ask; a release does not upgrade dependencies.
4. Commit only those two files, with the message `Release X.Y.Z` and the attribution line from the system reminder.
5. `git tag vX.Y.Z` (lightweight, on the release commit, like the earlier tags).
6. `git push origin main vX.Y.Z`. Never force-push and never move an existing tag.

## 4. Trial server

Restart the Tailscale trial server (port 8010) as described in CLAUDE.md, without asking, and check that `curl -s http://127.0.0.1:8010/api/health` shows the new `version`.

## 5. Report

Tell the organizer, in their language:

- the new version, the commit and the tag, and that both are pushed;
- a short list of what is new since the previous version, grouped and in plain words (from the `git log` of step 2, not the raw commit titles);
- the trial server's health version;
- that production is unchanged, and that `deploy-prod` deploys it when they ask.
