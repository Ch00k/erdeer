import * as arctic from "arctic";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function createProviders(callbackBaseUrl: string) {
  const providers: Record<string, arctic.GitHub | arctic.Google | arctic.GitLab> = {};

  if (process.env.GITHUB_CLIENT_ID) {
    providers.github = new arctic.GitHub(
      process.env.GITHUB_CLIENT_ID,
      requireEnv("GITHUB_CLIENT_SECRET"),
      `${callbackBaseUrl}/auth/github/callback`,
    );
  }

  if (process.env.GOOGLE_CLIENT_ID) {
    providers.google = new arctic.Google(
      process.env.GOOGLE_CLIENT_ID,
      requireEnv("GOOGLE_CLIENT_SECRET"),
      `${callbackBaseUrl}/auth/google/callback`,
    );
  }

  if (process.env.GITLAB_CLIENT_ID) {
    providers.gitlab = new arctic.GitLab(
      "https://gitlab.com",
      process.env.GITLAB_CLIENT_ID,
      requireEnv("GITLAB_CLIENT_SECRET"),
      `${callbackBaseUrl}/auth/gitlab/callback`,
    );
  }

  return providers;
}
