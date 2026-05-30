import type { CapabilityNeed } from "../types.js";

/**
 * Keyword -> capability mapping for offline intent analysis.
 * Each entry maps trigger words (matched case-insensitively as whole words or
 * substrings) to one or more capability ids.
 */
const INTENT_KEYWORDS: Array<{ triggers: string[]; caps: string[] }> = [
  { triggers: ["react", "reactjs"], caps: ["react", "frontend"] },
  { triggers: ["next", "nextjs", "next.js"], caps: ["nextjs", "react", "frontend"] },
  { triggers: ["vue", "vuejs"], caps: ["vue", "frontend"] },
  { triggers: ["frontend", "前端", "ui", "界面"], caps: ["frontend", "ui", "design"] },
  { triggers: ["design", "设计", "样式", "排版"], caps: ["design", "ui", "css"] },
  { triggers: ["tailwind"], caps: ["tailwind", "css", "frontend"] },
  { triggers: ["test", "testing", "测试", "单元测试"], caps: ["testing"] },
  { triggers: ["e2e", "end-to-end", "端到端", "playwright"], caps: ["testing", "e2e", "playwright"] },
  { triggers: ["debug", "debugging", "调试", "排查"], caps: ["debugging"] },
  { triggers: ["review", "code review", "代码审查", "评审"], caps: ["review", "quality"] },
  { triggers: ["docker", "container", "容器", "镜像"], caps: ["docker", "devops"] },
  { triggers: ["kubernetes", "k8s", "helm"], caps: ["kubernetes", "devops"] },
  { triggers: ["terraform", "opentofu", "iac", "基础设施"], caps: ["terraform", "iac", "devops"] },
  { triggers: ["deploy", "deployment", "部署", "上线", "ci", "cd", "ci/cd", "pipeline"], caps: ["ci-cd", "devops"] },
  { triggers: ["aws", "cloud", "云"], caps: ["aws", "cloud"] },
  { triggers: ["api", "rest", "endpoint", "接口"], caps: ["api", "rest", "backend"] },
  { triggers: ["graphql"], caps: ["graphql", "api", "backend"] },
  { triggers: ["backend", "server", "后端", "服务端"], caps: ["backend"] },
  { triggers: ["database", "sql", "数据库", "postgres", "mysql", "mongodb"], caps: ["database", "backend"] },
  { triggers: ["payment", "pay", "stripe", "支付", "收款", "结账", "checkout"], caps: ["payments", "security", "ecommerce"] },
  { triggers: ["ecommerce", "e-commerce", "shop", "store", "电商", "商城", "购物"], caps: ["ecommerce", "payments", "seo"] },
  { triggers: ["i18n", "internationalization", "localization", "国际化", "本地化", "多语言", "cross-border", "跨境"], caps: ["i18n", "localization"] },
  { triggers: ["seo", "search engine", "搜索引擎优化", "排名"], caps: ["seo", "web"] },
  { triggers: ["security", "secure", "安全", "漏洞", "vulnerability", "audit"], caps: ["security"] },
  { triggers: ["python", "py", "django", "flask", "fastapi"], caps: ["python", "backend"] },
  { triggers: ["go", "golang"], caps: ["go", "backend"] },
  { triggers: ["rust"], caps: ["rust", "backend"] },
  { triggers: ["data", "data science", "pandas", "analysis", "数据分析", "数据"], caps: ["data", "data-science", "python"] },
  { triggers: ["ml", "machine learning", "ai", "model", "机器学习", "人工智能", "模型"], caps: ["ai", "ml", "data-science"] },
  { triggers: ["pdf"], caps: ["pdf", "documents"] },
  { triggers: ["powerpoint", "pptx", "slides", "ppt", "演示"], caps: ["pptx", "documents"] },
  { triggers: ["word", "docx", "文档"], caps: ["docx", "documents"] },
  { triggers: ["excel", "xlsx", "spreadsheet", "表格"], caps: ["xlsx", "data", "documents"] },
  { triggers: ["changelog", "release notes", "发布说明", "变更日志"], caps: ["changelog", "docs"] },
  { triggers: ["docs", "documentation", "readme", "文档", "说明"], caps: ["docs"] },
  { triggers: ["marketing", "campaign", "营销", "推广", "市场", "增长", "growth", "gtm", "go-to-market"], caps: ["marketing", "growth", "content"] },
  { triggers: ["social media", "social", "社媒", "社交媒体", "twitter", "linkedin", "instagram", "tiktok", "微博", "小红书"], caps: ["social-media", "marketing", "content"] },
  { triggers: ["email", "newsletter", "邮件", "邮件营销", "edm"], caps: ["email", "marketing"] },
  { triggers: ["utm", "tracking", "归因", "投放追踪"], caps: ["utm", "analytics", "marketing"] },
  { triggers: ["video", "视频", "短视频", "动画", "animation", "motion graphics", "剪辑", "影片"], caps: ["video", "content-creation", "media"] },
  { triggers: ["remotion"], caps: ["video", "remotion", "content-creation"] },
  { triggers: ["poster", "海报", "banner", "横幅", "配图", "图片", "image", "graphic", "graphics", "插画", "illustration"], caps: ["image", "design", "content-creation"] },
  { triggers: ["logo", "品牌设计", "视觉设计", "visual design"], caps: ["design", "image", "content-creation"] },
  { triggers: ["gif", "动图", "表情包", "emoji"], caps: ["image", "animation", "content-creation"] },
  { triggers: ["mcp", "model context protocol", "tool server"], caps: ["mcp", "tools", "backend"] },
  { triggers: ["accessibility", "a11y", "wcag", "无障碍", "可访问性", "屏幕阅读"], caps: ["accessibility", "frontend", "quality"] },
  { triggers: ["chart", "charts", "visualization", "visualize", "dashboard", "图表", "可视化", "仪表盘"], caps: ["data", "visualization", "frontend"] },
  { triggers: ["sql", "query", "查询优化", "索引", "数据库优化"], caps: ["sql", "database", "backend"] },
  { triggers: ["artifact", "artifacts", "prototype", "原型", "交互页面"], caps: ["frontend", "artifacts", "web"] },
];

const LABELS: Record<string, string> = {
  react: "React",
  nextjs: "Next.js",
  frontend: "Frontend",
  ui: "UI",
  design: "Design",
  css: "CSS",
  tailwind: "Tailwind CSS",
  testing: "Testing",
  e2e: "End-to-end testing",
  playwright: "Playwright",
  debugging: "Debugging",
  review: "Code review",
  quality: "Quality",
  docker: "Docker",
  devops: "DevOps",
  kubernetes: "Kubernetes",
  terraform: "Terraform",
  iac: "Infrastructure as Code",
  "ci-cd": "CI/CD",
  aws: "AWS",
  cloud: "Cloud",
  api: "API",
  rest: "REST API",
  backend: "Backend",
  graphql: "GraphQL",
  database: "Database",
  payments: "Payments",
  security: "Security",
  ecommerce: "E-commerce",
  i18n: "Internationalization",
  localization: "Localization",
  seo: "SEO",
  web: "Web",
  python: "Python",
  go: "Go",
  rust: "Rust",
  data: "Data",
  "data-science": "Data Science",
  ai: "AI/ML",
  ml: "Machine Learning",
  pdf: "PDF",
  pptx: "PowerPoint",
  docx: "Word",
  xlsx: "Excel",
  documents: "Documents",
  changelog: "Changelog",
  docs: "Documentation",
  vue: "Vue",
  marketing: "Marketing",
  growth: "Growth",
  content: "Content",
  "social-media": "Social media",
  email: "Email marketing",
  utm: "UTM tracking",
  analytics: "Analytics",
  video: "Video",
  remotion: "Remotion",
  "content-creation": "Content creation",
  media: "Media",
  image: "Image / graphics",
  animation: "Animation",
  mcp: "MCP",
  tools: "Tools",
  accessibility: "Accessibility",
  visualization: "Data visualization",
  sql: "SQL",
  artifacts: "Web artifacts",
};

/**
 * Analyze a natural-language intent string and produce capability needs.
 * Purely offline / heuristic; an LLM can later refine this set.
 */
const CJK_RE = /[\u4e00-\u9fff]/;

/**
 * Whether a trigger occurs in the text. ASCII triggers must match on word
 * boundaries (so "ui" does not match "quick"); CJK triggers use substring
 * matching since Chinese text has no spaces.
 */
function triggerMatches(text: string, trigger: string): boolean {
  const t = trigger.toLowerCase();
  if (CJK_RE.test(t)) {
    return text.includes(t);
  }
  // Escape regex metacharacters, then require non-word boundaries on each side.
  // Allow an optional trailing plural "s" so "test" matches "tests", "api"
  // matches "apis", etc., without matching longer words like "testing".
  const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?<![a-z0-9])${escaped}s?(?![a-z0-9])`, "i");
  return re.test(text);
}

export function analyzeIntent(intent: string): CapabilityNeed[] {
  const text = intent.toLowerCase();
  const capMap = new Map<string, CapabilityNeed>();

  for (const entry of INTENT_KEYWORDS) {
    const hit = entry.triggers.find((t) => triggerMatches(text, t));
    if (!hit) continue;
    for (const cap of entry.caps) {
      const existing = capMap.get(cap);
      if (existing) {
        if (!existing.keywords.includes(hit)) existing.keywords.push(hit);
        existing.confidence = Math.min(1, existing.confidence + 0.1);
        continue;
      }
      capMap.set(cap, {
        id: cap,
        label: LABELS[cap] ?? cap,
        source: "intent",
        confidence: 0.7,
        keywords: [cap, hit].filter((v, i, a) => a.indexOf(v) === i),
      });
    }
  }

  return [...capMap.values()].sort((a, b) => b.confidence - a.confidence);
}

/** Merge needs from multiple origins, keeping the highest confidence per id. */
export function mergeNeeds(...groups: CapabilityNeed[][]): CapabilityNeed[] {
  const map = new Map<string, CapabilityNeed>();
  for (const group of groups) {
    for (const need of group) {
      const existing = map.get(need.id);
      if (!existing) {
        map.set(need.id, { ...need, keywords: [...need.keywords] });
        continue;
      }
      existing.confidence = Math.max(existing.confidence, need.confidence);
      for (const kw of need.keywords) {
        if (!existing.keywords.includes(kw)) existing.keywords.push(kw);
      }
    }
  }
  return [...map.values()].sort((a, b) => b.confidence - a.confidence);
}
