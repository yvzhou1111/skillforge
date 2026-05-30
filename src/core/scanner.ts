import { promises as fs } from "node:fs";
import path from "node:path";
import type { CapabilityNeed } from "../types.js";
import { pathExists, readTextIfExists } from "../util/fsx.js";

/**
 * Mapping from a dependency package name (substring match) to capability ids.
 * Kept intentionally small and explicit; extend as needed.
 */
const DEP_TO_CAPABILITIES: Array<{ match: RegExp; caps: string[] }> = [
  { match: /^react$|^react-dom$/, caps: ["react", "frontend"] },
  { match: /^next$/, caps: ["nextjs", "react", "frontend", "ssr"] },
  { match: /^vue$/, caps: ["vue", "frontend"] },
  { match: /^svelte$/, caps: ["svelte", "frontend"] },
  { match: /^@angular\//, caps: ["angular", "frontend"] },
  { match: /^tailwindcss$/, caps: ["tailwind", "css", "frontend"] },
  { match: /^typescript$/, caps: ["typescript"] },
  { match: /^jest$|^vitest$|^mocha$|^@testing-library\//, caps: ["testing"] },
  { match: /^@playwright\/test$|^playwright$/, caps: ["testing", "e2e", "playwright"] },
  { match: /^cypress$/, caps: ["testing", "e2e"] },
  { match: /^express$|^koa$|^fastify$|^@nestjs\//, caps: ["backend", "api", "rest"] },
  { match: /^graphql$|^@apollo\//, caps: ["graphql", "api", "backend"] },
  { match: /^stripe$|^@stripe\//, caps: ["payments", "ecommerce", "security"] },
  { match: /^i18next$|^react-i18next$|^next-intl$/, caps: ["i18n", "localization"] },
  { match: /^prisma$|^@prisma\/client$|^typeorm$|^sequelize$|^mongoose$/, caps: ["database", "backend"] },
  { match: /^aws-sdk$|^@aws-sdk\//, caps: ["aws", "cloud", "backend"] },
  { match: /^pandas$|^numpy$|^scikit-learn$|^matplotlib$/, caps: ["data", "data-science", "python"] },
  { match: /^torch$|^tensorflow$|^transformers$/, caps: ["ai", "ml", "data-science"] },
];

/** File-existence based capability hints. */
const FILE_HINTS: Array<{ file: string; caps: string[] }> = [
  { file: "Dockerfile", caps: ["docker", "devops"] },
  { file: "docker-compose.yml", caps: ["docker", "devops"] },
  { file: "docker-compose.yaml", caps: ["docker", "devops"] },
  { file: "go.mod", caps: ["go", "backend"] },
  { file: "Cargo.toml", caps: ["rust", "backend"] },
  { file: "pom.xml", caps: ["java", "backend"] },
  { file: "build.gradle", caps: ["java", "backend"] },
  { file: "Gemfile", caps: ["ruby", "backend"] },
  { file: "composer.json", caps: ["php", "backend"] },
  { file: "requirements.txt", caps: ["python", "backend"] },
  { file: "pyproject.toml", caps: ["python", "backend"] },
  { file: "next.config.js", caps: ["nextjs", "react", "frontend"] },
  { file: "next.config.mjs", caps: ["nextjs", "react", "frontend"] },
  { file: "next.config.ts", caps: ["nextjs", "react", "frontend"] },
  { file: "tailwind.config.js", caps: ["tailwind", "css", "frontend"] },
  { file: "tailwind.config.ts", caps: ["tailwind", "css", "frontend"] },
];

/** Directory hints. */
const DIR_HINTS: Array<{ dir: string; caps: string[] }> = [
  { dir: ".github/workflows", caps: ["ci-cd", "devops"] },
  { dir: "terraform", caps: ["terraform", "iac", "devops"] },
  { dir: "k8s", caps: ["kubernetes", "devops"] },
  { dir: "kubernetes", caps: ["kubernetes", "devops"] },
];

const LABELS: Record<string, string> = {
  react: "React",
  nextjs: "Next.js",
  vue: "Vue",
  svelte: "Svelte",
  angular: "Angular",
  tailwind: "Tailwind CSS",
  typescript: "TypeScript",
  testing: "Testing",
  e2e: "End-to-end testing",
  playwright: "Playwright",
  backend: "Backend",
  api: "API",
  rest: "REST API",
  graphql: "GraphQL",
  payments: "Payments",
  ecommerce: "E-commerce",
  security: "Security",
  i18n: "Internationalization",
  localization: "Localization",
  database: "Database",
  aws: "AWS",
  cloud: "Cloud",
  data: "Data",
  "data-science": "Data Science",
  python: "Python",
  ai: "AI/ML",
  ml: "Machine Learning",
  docker: "Docker",
  devops: "DevOps",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
  php: "PHP",
  "ci-cd": "CI/CD",
  terraform: "Terraform",
  iac: "Infrastructure as Code",
  kubernetes: "Kubernetes",
  frontend: "Frontend",
  ssr: "Server-side rendering",
  css: "CSS",
  vue3: "Vue 3",
};

function labelFor(id: string): string {
  return LABELS[id] ?? id;
}

interface ScanResult {
  needs: CapabilityNeed[];
  detectedFiles: string[];
  lowConfidence: boolean;
}

/**
 * Scan a project directory and infer capability needs from dependency files,
 * config files, and directory structure.
 */
export async function scanProject(root: string): Promise<ScanResult> {
  const capMap = new Map<string, CapabilityNeed>();
  const detectedFiles: string[] = [];

  function addCap(
    id: string,
    source: CapabilityNeed["source"],
    confidence: number,
    keyword: string
  ): void {
    const existing = capMap.get(id);
    if (existing) {
      existing.confidence = Math.max(existing.confidence, confidence);
      if (!existing.keywords.includes(keyword)) existing.keywords.push(keyword);
      return;
    }
    capMap.set(id, {
      id,
      label: labelFor(id),
      source,
      confidence,
      keywords: [id, keyword].filter((v, i, a) => a.indexOf(v) === i),
    });
  }

  // 1. package.json dependencies
  const pkgPath = path.join(root, "package.json");
  const pkgRaw = await readTextIfExists(pkgPath);
  if (pkgRaw) {
    detectedFiles.push("package.json");
    try {
      const pkg = JSON.parse(pkgRaw) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = {
        ...(pkg.dependencies ?? {}),
        ...(pkg.devDependencies ?? {}),
      };
      for (const dep of Object.keys(allDeps)) {
        for (const rule of DEP_TO_CAPABILITIES) {
          if (rule.match.test(dep)) {
            for (const cap of rule.caps) addCap(cap, "dependency", 0.9, dep);
          }
        }
      }
    } catch {
      // ignore malformed package.json
    }
  }

  // 2. Python dependency files (simple keyword scan)
  for (const pyFile of ["requirements.txt", "pyproject.toml"]) {
    const raw = await readTextIfExists(path.join(root, pyFile));
    if (raw) {
      const lower = raw.toLowerCase();
      for (const rule of DEP_TO_CAPABILITIES) {
        // reuse rules whose match could appear as plain package names
        const probe = rule.match.source.replace(/[\^$]/g, "").split("|")[0];
        if (probe && lower.includes(probe.replace(/\\/g, ""))) {
          for (const cap of rule.caps) addCap(cap, "dependency", 0.75, probe);
        }
      }
    }
  }

  // 3. File hints
  for (const hint of FILE_HINTS) {
    if (await pathExists(path.join(root, hint.file))) {
      detectedFiles.push(hint.file);
      for (const cap of hint.caps) addCap(cap, "dependency", 0.85, hint.file);
    }
  }

  // 4. Directory hints
  for (const hint of DIR_HINTS) {
    if (await pathExists(path.join(root, hint.dir))) {
      detectedFiles.push(hint.dir + "/");
      for (const cap of hint.caps) addCap(cap, "heuristic", 0.7, hint.dir);
    }
  }

  // 5. Extension-based heuristic fallback if nothing found
  let lowConfidence = false;
  if (capMap.size === 0) {
    lowConfidence = true;
    const exts = await sampleExtensions(root);
    const extCaps: Record<string, string[]> = {
      ".ts": ["typescript"],
      ".tsx": ["typescript", "react", "frontend"],
      ".jsx": ["react", "frontend"],
      ".py": ["python", "backend"],
      ".go": ["go", "backend"],
      ".rs": ["rust", "backend"],
      ".java": ["java", "backend"],
      ".rb": ["ruby", "backend"],
      ".php": ["php", "backend"],
    };
    for (const ext of exts) {
      for (const cap of extCaps[ext] ?? []) addCap(cap, "heuristic", 0.45, ext);
    }
  }

  const needs = [...capMap.values()].sort((a, b) => b.confidence - a.confidence);
  return { needs, detectedFiles, lowConfidence };
}

async function sampleExtensions(root: string, limit = 400): Promise<Set<string>> {
  const found = new Set<string>();
  let count = 0;

  async function walk(dir: string, depth: number): Promise<void> {
    if (depth > 4 || count > limit) return;
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (count > limit) return;
      if (entry.name.startsWith(".") || entry.name === "node_modules") continue;
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(abs, depth + 1);
      } else if (entry.isFile()) {
        count++;
        const ext = path.extname(entry.name);
        if (ext) found.add(ext);
      }
    }
  }

  await walk(root, 0);
  return found;
}
