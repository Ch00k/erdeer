const KEY = "erdeer_sandbox";

export interface SandboxDoc {
  title: string;
  amlContent: string;
  layout: string;
}

export const SANDBOX_SEED: SandboxDoc = {
  title: "Untitled diagram",
  amlContent: `users
  id uuid pk
  email varchar unique
  name varchar
  created_at timestamp

posts | Blog posts authored by users
  id uuid pk
  author_id uuid -> users(id)
  title varchar
  body text
  published_at timestamp nullable
  created_at timestamp

comments | Threaded comments on posts
  id uuid pk
  post_id uuid -> posts(id)
  author_id uuid -> users(id)
  body text
  created_at timestamp
`,
  layout: "{}",
};

export function getSandbox(): SandboxDoc | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed?.title === "string" &&
      typeof parsed?.amlContent === "string" &&
      typeof parsed?.layout === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function setSandbox(doc: SandboxDoc) {
  localStorage.setItem(KEY, JSON.stringify(doc));
}

export function clearSandbox() {
  localStorage.removeItem(KEY);
}
