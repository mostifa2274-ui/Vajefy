#!/usr/bin/env bash
# Commit only generated audio-certification evidence to main.
set -euo pipefail

MESSAGE="${1:?commit message required}"

npm run -s assurance:audio:check

ALLOWED=(
  content/assurance/audio/recognition.json
  content/assurance/audio/certificates.json
)

for FILE in "${ALLOWED[@]}"; do
  git add -- "$FILE"
done

UNEXPECTED="$(
  {
    git diff --name-only
    git ls-files --others --exclude-standard
  } | sort -u | grep -v '^$' || true
)"
if [ -n "$UNEXPECTED" ]; then
  echo "Unexpected audio-certification write outside the allowlist:" >&2
  printf '%s\n' "$UNEXPECTED" >&2
  exit 1
fi

if git diff --cached --quiet; then
  echo "Nothing to record."
  exit 0
fi
git diff --cached --name-only

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "$MESSAGE"

for TRY in 1 2 3; do
  if git push origin HEAD:main; then
    exit 0
  fi
  echo "Push attempt ${TRY} failed; rebasing on main and rechecking evidence freshness." >&2
  git pull --rebase origin main
  npm run -s assurance:audio:check
done

echo "Could not push audio-certification evidence to main." >&2
exit 1
