#!/usr/bin/env bash
# Commits the calibration automation's own records to main, and nothing else.
# Used by .github/workflows/semantic-calibrate.yml.
#
#   scripts/semantic-calibration-commit.sh <role or empty> <commit message>
set -euo pipefail

ROLE="${1:-}"
MESSAGE="${2:?commit message required}"

npm run -s assurance:semantic:automation:check
npm run -s assurance:semantic:budget:check
npm run -s assurance:semantic:keyless:check
npm run -s assurance:semantic:qualification:check

ALLOWED=(
  content/assurance/semantic/keyless-provider-presets.json
  content/assurance/semantic/workers-ai-neuron-rates.json
  content/assurance/semantic/calibration/v1/neuron-budget.json
  content/assurance/semantic/calibration/qualified.json
  content/assurance/semantic/calibration/rejected.json
  content/assurance/semantic/calibration/automation-log.json
  "content/assurance/semantic/calibration/results/${ROLE}.json"
)
for FILE in "${ALLOWED[@]}"; do
  if [ -e "$FILE" ]; then
    git add -- "$FILE"
  fi
done

if [ -n "$(git diff --name-only)" ]; then
  echo "Unexpected calibration write outside the allowlist:" >&2
  git diff --name-only >&2
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
  echo "Push attempt ${TRY} failed; rebasing on main." >&2
  git pull --rebase origin main
done
echo "Could not push the calibration record to main." >&2
exit 1
