#!/usr/bin/env bash
# Bring your current branch up to date with origin/main (fetch + rebase).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "You have uncommitted changes. Commit them first (git add -A && git commit -m 'wip')."
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
git fetch origin
if [ "$branch" = "main" ]; then
  git pull --rebase origin main
else
  git rebase origin/main || {
    echo
    echo "Rebase stopped on a conflict. See docs/WORKFLOW.md → 'If you do get a conflict'."
    echo "To back out: git rebase --abort"
    exit 1
  }
fi

echo
echo "Up to date with origin/main on '$branch'."
echo "Latest decision:"
grep -E '^## D[0-9]+' docs/DECISIONS.md | tail -n 1 || true
