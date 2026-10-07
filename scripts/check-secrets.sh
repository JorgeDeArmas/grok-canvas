#!/usr/bin/env bash
# Gitleaks-style scan for the public canvas repo. Fails if secrets, plaintext media, or keyed links sneak in.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
hit() { echo "FAIL $1"; fail=1; }

if git ls-files | grep -E '\.dev\.vars$|^\.env$|\.env\.local$'; then
  hit "tracked env/secret file"
fi
if git ls-files | grep -Ei '\.(mp4|mov|jpg|jpeg|png|wav|m4a)$' | grep -v '\.enc$'; then
  hit "plaintext media tracked"
fi

# Full keyed canvas links and raw keys must never land in git history of tracked files.
while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    scripts/check-secrets.sh|tests/*|media/*|scenes/*) continue ;;
  esac
  if grep -En '#b=[A-Za-z0-9_-]+&k=' "$f"; then hit "$f: keyed link (#k=)"; fi
  if grep -En '\b(sk-|ghp_|ghs_|github_pat_|AKIA)[A-Za-z0-9]' "$f"; then hit "$f: token shape"; fi
  if grep -En 'CLOUDFLARE_API_TOKEN|R2_SECRET_ACCESS_KEY=[^<]' "$f"; then hit "$f: cloud secret"; fi
done < <(git ls-files)

if git grep -n "wrangler deploy" -- ':!scripts/check-secrets.sh' ':!README.md' >/dev/null 2>&1; then
  : # mention in docs is ok
fi

if [ "$fail" -ne 0 ]; then
  echo "secret check failed"
  exit 1
fi
echo "secret check OK"
