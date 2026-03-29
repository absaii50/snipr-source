#!/bin/bash
# Push current code to GitHub (absaii50/snipr-source)
# Uses GITHUB_PAT secret for authentication

set -e

if [ -z "$GITHUB_PAT" ]; then
  echo "Error: GITHUB_PAT environment variable is not set."
  exit 1
fi

REPO_URL="https://absaii50:${GITHUB_PAT}@github.com/absaii50/snipr-source.git"

echo "Pushing to GitHub..."
git push "$REPO_URL" HEAD:main --force-with-lease

echo "Done! Code pushed to github.com/absaii50/snipr-source"
