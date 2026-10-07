#!/usr/bin/env bash
# Commit only generated audio-assurance evidence and certified promotions.
set -euo pipefail

MESSAGE="${1:?commit message required}"
case "$MESSAGE" in
  *"[audio-bot]"*) ;;
  *)
    echo "Audio automation commits must include [audio-bot] to prevent self-trigger loops." >&2
    exit 1
    ;;
esac

npm run -s assurance:audio:check
npm run -s assurance:audio:repair:check
node --experimental-strip-types --no-warnings --import ./scripts/ts-test-register.mjs scripts/build-content.ts --check

is_allowed() {
  case "$1" in
    content/assurance/audio/recognition.json|\
    content/assurance/audio/certificates.json|\
    content/assurance/audio/repair-log.json|\
    content/pilot/audio-manifest.json|\
    content/pilot/audio-report.json|\
    content/compiled/enhanced.json|\
    public/data/enhanced-order.json|\
    public/data/enhanced/*.json|\
    public/audio/pilot/*.mp3)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

CHANGED="$(
  {
    git diff --name-only
    git ls-files --others --exclude-standard
  } | sort -u | grep -v '^$' || true
)"

UNEXPECTED=""
while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  if ! is_allowed "$FILE"; then
    UNEXPECTED="${UNEXPECTED}${FILE}"$'\n'
  fi
done <<< "$CHANGED"

if [ -n "$UNEXPECTED" ]; then
  echo "Unexpected audio-assurance write outside the allowlist:" >&2
  printf '%s' "$UNEXPECTED" >&2
  exit 1
fi

while IFS= read -r FILE; do
  [ -z "$FILE" ] && continue
  git add -- "$FILE"
done <<< "$CHANGED"

if git diff --cached --quiet; then
  echo "Nothing to record."
  exit 0
fi

echo "Audio automation will commit only:"
git diff --cached --name-only

git config user.name "github-actions[bot]"
git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
git commit -m "$MESSAGE"

for TRY in 1 2 3; do
  if git push origin HEAD:main; then
    exit 0
  fi
  echo "Push attempt ${TRY} failed; rebasing on main and rechecking exact evidence." >&2
  git pull --rebase origin main
  npm run -s assurance:audio:check
  npm run -s assurance:audio:repair:check
  node --experimental-strip-types --no-warnings --import ./scripts/ts-test-register.mjs scripts/build-content.ts --check
done

echo "Could not push audio-assurance evidence to main." >&2
exit 1
