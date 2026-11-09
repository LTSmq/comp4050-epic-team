import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

function getBuildCommit(): string {
  const isCommit = (value: string) => /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(value);
  const configured = process.env.BUILD_COMMIT_SHA?.trim();
  if (configured && isCommit(configured)) return configured;

  try {
    const commit = execFileSync("git", ["rev-parse", "HEAD"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return isCommit(commit) ? commit : "";
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  env: { NEXT_PUBLIC_BUILD_COMMIT: getBuildCommit() },
};

export default nextConfig;
