import dotenv from "dotenv";
import fs from "node:fs";

function resolveFirstExistingFile(paths: string[]): string {
  for (const path of paths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  return paths[0] ?? ".env";
}

function resolveEnvFile(): string {
  const explicitEnvFile = process.env.ENV_FILE?.trim();

  if (explicitEnvFile) {
    return explicitEnvFile;
  }

  if (process.env.JEST_WORKER_ID) {
    return resolveFirstExistingFile([".env.test", ".env.example"]);
  }

  if (process.env.NODE_ENV === "production") {
    return resolveFirstExistingFile([".env", ".env.example"]);
  }

  if (process.env.NODE_ENV === "test") {
    return resolveFirstExistingFile([".env.test", ".env.example"]);
  }

  return resolveFirstExistingFile([
    ".env.development",
    ".env.local",
    ".env",
    ".env.example",
  ]);
}

dotenv.config({
  path: resolveEnvFile(),
  override: false,
  quiet: Boolean(process.env.JEST_WORKER_ID),
});
