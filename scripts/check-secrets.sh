#!/usr/bin/env bash
# Gitleaks-style scan for the public canvas repo. Fails if secrets, plaintext media, or keyed links sneak in.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
fail=0
hit() { echo "FAIL $1"; fail=1; }

if git ls-files | grep -E '\.dev\.vars$|^\.env$|\.env\.local$' >/dev/null; then
  hit "tracked env/secret file"
fi

while IFS= read -r f; do
  [ -n "$f" ] || continue
  case "$f" in
    app/icons/*.png)
      if [ ! -f app/icons/ICONS.sha256 ]; then
        hit "$f: png without ICONS.sha256"
        continue
      fi
      got="$(sha256sum "$f" | awk '{print $1}')"
      name="$(basename "$f")"
      if ! awk '{print $1,$2}' app/icons/ICONS.sha256 | grep -q "^${got}  ${name}$" && ! grep -q "${got}  ${name}" app/icons/ICONS.sha256; then
        hit "$f: png hash not in ICONS.sha256"
      fi
      ;;
    *.mp4|*.mov|*.jpg|*.jpeg|*.png|*.wav|*.m4a)
      case "$f" in
        *.enc) ;;
        *) hit "plaintext media tracked: $f" ;;
      esac
      ;;
  esac
done < <(git ls-files | grep -Ei '\.(mp4|mov|jpg|jpeg|png|wav|m4a)$' || true)

while IFS= read -r f; do
  [ -f "$f" ] || continue
  case "$f" in
    scripts/check-secrets.sh|tests/*|media/*|scenes/*) continue ;;
  esac
  if grep -En '#b=[A-Za-z0-9_-]+&k=' "$f"; then hit "$f: keyed link (#k=)"; fi
  if grep -En '\b(sk-|ghp_|ghs_|github_pat_|AKIA)[A-Za-z0-9]' "$f"; then hit "$f: token shape"; fi
  if grep -En 'CLOUDFLARE_API_TOKEN|R2_SECRET_ACCESS_KEY=[^<]' "$f"; then hit "$f: cloud secret"; fi
done < <(git ls-files)

if [ -n "${PRIVATE_NAME_DENYLIST:-}" ]; then
  IFS=',' read -ra names <<< "$PRIVATE_NAME_DENYLIST"
  for n in "${names[@]}"; do
    n="$(echo "$n" | tr -d ' ')"
    [ -n "$n" ] || continue
    if git grep -nI -i --fixed-string "$n" -- ':!docs/site-v2/*' ':!scripts/check-secrets.sh' >/dev/null 2>&1; then
      hit "denylist name present"
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  echo "secret check failed"
  exit 1
fi
echo "secret check OK"
