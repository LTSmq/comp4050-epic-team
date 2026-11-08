# Staging releases on Google Cloud Run

The Staging release workflow checks the commit, builds and pushes both images, and creates Cloud Run revisions by image digest. It moves traffic only after Cloud Run accepts both revisions. GitHub Actions records the commit, image digests, and the previous and candidate revisions in the run summary.

## One-time setup

The staging release waits for build, lint, typecheck, and solver checks on `main`. Anyone who can push to an unprotected `main` can change those checks or the workflow that requests staging credentials. Limit write access to people trusted to deploy staging.

1. A GCP administrator runs the following in Cloud Shell. The release account can write to the existing registry, update the two staging services, and act as their existing runtime accounts. GitHub receives short-lived credentials scoped to this repository and the staging release workflow on `main`. [Google deployment federation guide](https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines)

```bash
PROJECT=fantastic-fit-513517
REGION=australia-southeast1
PROJECT_NUMBER=757278631968
RELEASE_SA="epic-fit-staging-release@$PROJECT.iam.gserviceaccount.com"
POOL=epic-fit-github-staging
PROVIDER=github

gcloud services enable iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com --project="$PROJECT"
gcloud iam service-accounts create epic-fit-staging-release --project="$PROJECT" \
  --display-name="Epic Fit staging release"

gcloud artifacts repositories add-iam-policy-binding perfect-fit --project="$PROJECT" --location="$REGION" \
  --member="serviceAccount:$RELEASE_SA" --role=roles/artifactregistry.writer

for SERVICE in epic-fit-web-staging epic-fit-solver-staging; do
  gcloud run services add-iam-policy-binding "$SERVICE" --project="$PROJECT" --region="$REGION" \
    --member="serviceAccount:$RELEASE_SA" --role=roles/run.developer
  gcloud iam service-accounts add-iam-policy-binding "$SERVICE@$PROJECT.iam.gserviceaccount.com" \
    --project="$PROJECT" --member="serviceAccount:$RELEASE_SA" --role=roles/iam.serviceAccountUser
done

gcloud iam workload-identity-pools create "$POOL" --project="$PROJECT" --location=global \
  --display-name="Epic Fit GitHub staging"
gcloud iam workload-identity-pools providers create-oidc "$PROVIDER" --project="$PROJECT" --location=global \
  --workload-identity-pool="$POOL" --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository_id=assertion.repository_id,attribute.repository_owner_id=assertion.repository_owner_id,attribute.ref=assertion.ref,attribute.workflow_ref=assertion.workflow_ref,attribute.event_name=assertion.event_name" \
  --attribute-condition="attribute.repository_owner_id == '100747348' && attribute.repository_id == '1323624252' && attribute.ref == 'refs/heads/main' && attribute.workflow_ref == 'LTSmq/comp4050-epic-team/.github/workflows/staging-release.yaml@refs/heads/main' && attribute.event_name in ['push', 'workflow_dispatch']"
gcloud iam service-accounts add-iam-policy-binding "$RELEASE_SA" --project="$PROJECT" \
  --role=roles/iam.workloadIdentityUser \
  --member="principalSet://iam.googleapis.com/projects/$PROJECT_NUMBER/locations/global/workloadIdentityPools/$POOL/attribute.repository_id/1323624252"
```

2. In **Settings → Secrets and variables → Actions → Variables**, set `GCP_STAGING_WIF_PROVIDER` to `projects/757278631968/locations/global/workloadIdentityPools/epic-fit-github-staging/providers/github`.
3. After the workflow is merged and the provider is enabled, run **Actions → Staging release → Run workflow** on `main`. Sign in to the staging website and submit a labelled demo order. Check that the order finishes and its 3D packing layout opens.
4. Set the GitHub repository variable `GCP_STAGING_AUTO_DEPLOY` to `true`. The workflow then releases on pushes to `main` that change website, solver, or release files. To pause automatic runs, set the variable to `false`. Manual runs on `main` remain available.

## Recovery

The workflow expects each service to begin with one revision serving all traffic. If traffic promotion fails, it attempts to restore both previous revisions. For an application failure after a successful release, copy the previous revisions from the run summary and restore each service in **Cloud Run → Revisions → Manage traffic**, or run the following with each service and its previous revision.

```bash
gcloud run services update-traffic SERVICE --project=fantastic-fit-513517 \
  --region=australia-southeast1 --to-revisions=PREVIOUS_REVISION=100
```

Recheck the packing flow after rollback. If a newer release is in progress, pause auto deploy and let the active workflow finish before moving traffic manually. [Cloud Run rollback guide](https://docs.cloud.google.com/run/docs/rollouts-rollbacks-traffic-migration)
