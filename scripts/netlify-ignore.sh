#!/bin/sh
# Netlify "ignore" check: exit 0 skips the build, exit 1 builds.
# Only the deploy branch builds, and only when the commit message has "[deploy]".
# Deploy previews and other branches never build, so they don't burn build credits.
DEPLOY_BRANCH="claude/kickoff-setup-pqyfzp"

if [ "$BRANCH" != "$DEPLOY_BRANCH" ]; then
  echo "Skipping build: $BRANCH is not the deploy branch."
  exit 0
fi

if git log -1 --pretty=%B "${COMMIT_REF:-HEAD}" | grep -qF "[deploy]"; then
  echo "Building: commit message has [deploy]."
  exit 1
fi

echo "Skipping build: add [deploy] to the merge commit message to ship."
exit 0
