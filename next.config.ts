import type { NextConfig } from "next";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,

  ...(process.env.GITHUB_ACTIONS === "true" && repoName
    ? { basePath: `/${repoName}` }
    : {}),
};

export default nextConfig;
