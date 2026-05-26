import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import fs from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const defaultMirrorRoot = path.resolve(
  repoRoot,
  "..",
  "..",
  "inspect-ph-mirror",
);
const mirrorRoot = process.env.XYPES_MIRROR_ROOT?.trim()
  ? path.resolve(process.env.XYPES_MIRROR_ROOT)
  : defaultMirrorRoot;
const outputDir = path.join(mirrorRoot, "xypes-inspectph-api");

async function run(command, args, cwd = repoRoot) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} failed with exit code ${code ?? 1}`,
        ),
      );
    });
    child.on("error", reject);
  });
}

async function ensureCleanDir(directory) {
  await fs.rm(directory, { force: true, recursive: true });
  await fs.mkdir(directory, { recursive: true });
}

async function copyDirectory(source, destination) {
  await fs.mkdir(destination, { recursive: true });
  const entries = await fs.readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
      continue;
    }

    await fs.copyFile(sourcePath, destinationPath);
  }
}

async function walk(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await walk(entryPath)));
      continue;
    }

    files.push(entryPath);
  }

  return files;
}

async function minifyJavaScript(directory) {
  const files = await walk(directory);

  for (const filePath of files) {
    if (!filePath.endsWith(".js")) {
      continue;
    }

    const source = await fs.readFile(filePath, "utf8");
    const result = await transform(source, {
      format: "esm",
      legalComments: "none",
      minify: true,
      sourcemap: false,
      target: "es2020",
    });

    await fs.writeFile(filePath, result.code);
  }
}

function buildMirrorPackageJson(sourcePackageJson) {
  return {
    name: "xypes-inspectph-api",
    version: sourcePackageJson.version,
    private: true,
    type: "module",
    scripts: {
      start: "node dist/server.js",
      "prisma:generate": "prisma generate",
    },
    dependencies: {
      ...sourcePackageJson.dependencies,
      prisma: sourcePackageJson.devDependencies.prisma,
    },
    engines: {
      node: ">=20",
    },
  };
}

async function prepareMirror() {
  await run("npm", ["run", "build"]);
  await ensureCleanDir(outputDir);

  await copyDirectory(
    path.join(repoRoot, "dist"),
    path.join(outputDir, "dist"),
  );
  await copyDirectory(
    path.join(repoRoot, "prisma"),
    path.join(outputDir, "prisma"),
  );
  await minifyJavaScript(path.join(outputDir, "dist"));

  const packageJson = JSON.parse(
    await fs.readFile(path.join(repoRoot, "package.json"), "utf8"),
  );

  await fs.writeFile(
    path.join(outputDir, "package.json"),
    `${JSON.stringify(buildMirrorPackageJson(packageJson), null, 2)}\n`,
  );
  await fs.writeFile(
    path.join(outputDir, ".gitignore"),
    ["node_modules/", ".env", ".env.*", "npm-debug.log*"].join("\n") + "\n",
  );
}

const mode = process.argv[2] ?? "prepare";

if (mode === "prepare") {
  await prepareMirror();
} else {
  throw new Error(`Unsupported mode: ${mode}`);
}
