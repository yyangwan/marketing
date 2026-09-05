#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "Usage: $0 <git-sha> <release-archive>" >&2
  exit 2
fi

release_sha="$1"
release_archive="$2"
release_root="/opt/contentos-releases"
state_root="/opt/contentos-deploy"
release_dir="${release_root}/${release_sha}"
active_file="${state_root}/active-release"
previous_file="${state_root}/previous-release"
runtime_env="/opt/marketing/.env"
release_config="/opt/marketing/deploy/ecosystem.config.cjs"
legacy_config="/opt/marketing/ecosystem.config.cjs"
candidate_name="genilink-content-candidate"

if [[ ! "$release_sha" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release SHA: $release_sha" >&2
  exit 2
fi
if [[ ! -f "$release_archive" ]]; then
  echo "Release archive not found: $release_archive" >&2
  exit 2
fi
if [[ ! -f "$runtime_env" ]]; then
  echo "Runtime environment not found: $runtime_env" >&2
  exit 2
fi

mkdir -p "$release_root" "$state_root" "$release_dir"
tar -xzf "$release_archive" -C "$release_dir"
ln -sfn "$runtime_env" "$release_dir/.env"

if [[ ! -f "$release_dir/server.js" ]]; then
  echo "Standalone server missing from release" >&2
  exit 1
fi

pm2 delete "$candidate_name" >/dev/null 2>&1 || true
(
  cd "$release_dir"
  NODE_ENV=production HOSTNAME=127.0.0.1 PORT=4012 \
    pm2 start server.js --name "$candidate_name" --update-env
)

candidate_ok=false
for attempt in 1 2 3 4 5 6; do
  if curl --fail --silent --show-error http://127.0.0.1:4012/ >/dev/null; then
    candidate_ok=true
    break
  fi
  sleep 5
done
pm2 delete "$candidate_name" >/dev/null 2>&1 || true

if [[ "$candidate_ok" != true ]]; then
  echo "Candidate release failed health checks" >&2
  exit 1
fi

previous_release=""
if [[ -f "$active_file" ]]; then
  previous_release="$(<"$active_file")"
fi

CONTENTOS_RELEASE_DIR="$release_dir" \
  pm2 startOrReload "$release_config" --only genilink-content --update-env

active_ok=false
for attempt in 1 2 3 4 5 6; do
  if curl --fail --silent --show-error http://127.0.0.1:4002/ >/dev/null; then
    active_ok=true
    break
  fi
  sleep 5
done

if [[ "$active_ok" != true ]]; then
  echo "Active release failed health checks; restoring previous process" >&2
  if [[ -n "$previous_release" && -f "$previous_release/server.js" ]]; then
    CONTENTOS_RELEASE_DIR="$previous_release" \
      pm2 startOrReload "$release_config" --only genilink-content --update-env
  elif [[ -f "$legacy_config" ]]; then
    pm2 startOrReload "$legacy_config" --only genilink-content --update-env
  fi
  exit 1
fi

if [[ -n "$previous_release" ]]; then
  printf '%s\n' "$previous_release" > "$previous_file"
fi
printf '%s\n' "$release_dir" > "$active_file"
pm2 save
rm -f -- "$release_archive"

echo "ContentOS release active: $release_sha"
