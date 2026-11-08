#!/usr/bin/env bash
set -euo pipefail

project=fantastic-fit-513517
region=australia-southeast1
website=epic-fit-web-staging
solver=epic-fit-solver-staging
suffix="gh-${GITHUB_RUN_ID}-${GITHUB_RUN_ATTEMPT}"
run_flags=(--project="$project" --region="$region" --quiet)

serving_revision() {
  gcloud run services describe "$1" "${run_flags[@]}" --format=json |
    jq -er '
      [.status.traffic[] | select((.percent // 0) > 0)] |
      if length == 1 and .[0].percent == 100 and (.[0].revisionName | type == "string")
      then .[0].revisionName
      else error("Expected one serving revision with 100% of traffic")
      end
    '
}

create_revision() {
  gcloud run deploy "$1" "${run_flags[@]}" --image="$2" \
    --revision-suffix="$suffix" --no-traffic
}

route_traffic() {
  gcloud run services update-traffic "$1" "${run_flags[@]}" --to-revisions="$2=100"
}

previous_website=$(serving_revision "$website")
previous_solver=$(serving_revision "$solver")
next_website="$website-$suffix"
next_solver="$solver-$suffix"

{
  printf '### Staging release for `%s`\n\n' "$GITHUB_SHA"
  printf '| Service | Previous revision | Candidate revision | Image |\n'
  printf '| --- | --- | --- | --- |\n'
  printf '| %s | %s | %s | `%s` |\n' "$website" "$previous_website" "$next_website" "$1"
  printf '| %s | %s | %s | `%s` |\n' "$solver" "$previous_solver" "$next_solver" "$2"
} >> "$GITHUB_STEP_SUMMARY"

create_revision "$solver" "$2"
create_revision "$website" "$1"

# A newer code change may have landed while this run was building its images.
git fetch --quiet --no-tags --depth=1 origin refs/heads/main
if ! git diff --quiet "$GITHUB_SHA" FETCH_HEAD -- website solver .github/workflows .github/scripts/deploy-staging.sh; then
  echo 'Superseded by a change on main. The previous revisions still serve traffic.' | tee -a "$GITHUB_STEP_SUMMARY"
  exit 0
fi

if ! route_traffic "$solver" "$next_solver" || ! route_traffic "$website" "$next_website"; then
  echo 'Traffic promotion failed. Restoring the previous revisions.' | tee -a "$GITHUB_STEP_SUMMARY"
  route_traffic "$solver" "$previous_solver" || echo "Restore $solver to $previous_solver manually." | tee -a "$GITHUB_STEP_SUMMARY"
  route_traffic "$website" "$previous_website" || echo "Restore $website to $previous_website manually." | tee -a "$GITHUB_STEP_SUMMARY"
  exit 1
fi

printf '\nBoth candidate revisions now serve staging traffic.\n' >> "$GITHUB_STEP_SUMMARY"
