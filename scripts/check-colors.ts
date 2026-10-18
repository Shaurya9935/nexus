import fs from "node:fs";
import path from "node:path";

const TARGET_DIRS = ["app", "components", "features", "hooks"];
const VALID_EXTENSIONS = new Set([".ts", ".tsx", ".css", ".js", ".jsx"]);

// Explicitly allowlisted files per design token architecture:
// 1. app/globals.css - The central source of truth for semantic design tokens (:root and .dark).
// 2. components/connect/brand-icons.tsx - Official third-party brand logos (Google, Slack, Notion, Zoom, etc.)
// 3. components/auth/icons.tsx - Official 4-color Google authentication logo
// 4. components/inbox/email-body.tsx - Paper container with fixed white background for authentic email contrast
// 5. lib/email-templates - Email templates for Resend (email clients do not support CSS variables)
const ALLOWLIST_FILES = new Set([
  path.normalize("app/globals.css"),
  path.normalize("components/connect/brand-icons.tsx"),
  path.normalize("components/auth/icons.tsx"),
  path.normalize("components/inbox/email-body.tsx"),
]);

const ALLOWLIST_PREFIXES = [
  path.normalize("lib/email-templates"),
];

const HEX_COLOR_REGEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;
const RGB_COLOR_REGEX = /\brgba?\([^)]*\)/gi;
const HSL_COLOR_REGEX = /\bhsla?\([^)]*\)/gi;
const NON_TOKEN_TAILWIND_REGEX =
  /\b(?:text|bg|border|ring|divide|from|via|to|fill|stroke|outline|shadow|accent|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?\b/g;

interface Violation {
  file: string;
  line: number;
  match: string;
  rule: string;
  preview: string;
}

function scanFile(filePath: string, relativePath: string): Violation[] {
  const normalizedRel = path.normalize(relativePath);
  if (ALLOWLIST_FILES.has(normalizedRel) || ALLOWLIST_PREFIXES.some((p) => normalizedRel.startsWith(p))) {
    return [];
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n");
  const violations: Violation[] = [];

  lines.forEach((lineText, index) => {
    const lineNum = index + 1;
    const trimmed = lineText.trim();

    // Skip comment lines in ts/tsx/css
    if (trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {
      return;
    }

    // 1. Check for Hex colors
    const hexMatches = lineText.match(HEX_COLOR_REGEX);
    if (hexMatches) {
      for (const m of hexMatches) {
        // Skip SVG fragment URLs or anchor hashes like #top, #features, etc.
        if (m.length === 4 || m.length === 5 || m.length === 7 || m.length === 9) {
          violations.push({
            file: normalizedRel,
            line: lineNum,
            match: m,
            rule: "Hardcoded Hex Color (use var(--token) instead)",
            preview: trimmed,
          });
        }
      }
    }

    // 2. Check for rgb/rgba
    const rgbMatches = lineText.match(RGB_COLOR_REGEX);
    if (rgbMatches) {
      for (const m of rgbMatches) {
        violations.push({
          file: normalizedRel,
          line: lineNum,
          match: m,
          rule: "Raw rgb()/rgba() color literal (use var(--token) instead)",
          preview: trimmed,
        });
      }
    }

    // 3. Check for hsl/hsla
    const hslMatches = lineText.match(HSL_COLOR_REGEX);
    if (hslMatches) {
      for (const m of hslMatches) {
        violations.push({
          file: normalizedRel,
          line: lineNum,
          match: m,
          rule: "Raw hsl()/hsla() color literal (use var(--token) instead)",
          preview: trimmed,
        });
      }
    }

    // 4. Check for non-token Tailwind colors
    const twMatches = lineText.match(NON_TOKEN_TAILWIND_REGEX);
    if (twMatches) {
      for (const m of twMatches) {
        violations.push({
          file: normalizedRel,
          line: lineNum,
          match: m,
          rule: "Non-token Tailwind color class (use semantic tokens instead)",
          preview: trimmed,
        });
      }
    }
  });

  return violations;
}

function walkDirectory(dir: string, baseDir: string): Violation[] {
  let results: Violation[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".git") {
        continue;
      }
      results = results.concat(walkDirectory(fullPath, baseDir));
    } else if (entry.isFile() && VALID_EXTENSIONS.has(path.extname(entry.name))) {
      results = results.concat(scanFile(fullPath, relPath));
    }
  }

  return results;
}

function main() {
  const rootDir = process.cwd();
  console.log("🔍 Scanning codebase for hardcoded colors and non-token Tailwind classes...\n");

  const allViolations: Violation[] = [];

  for (const target of TARGET_DIRS) {
    const targetPath = path.join(rootDir, target);
    if (fs.existsSync(targetPath)) {
      allViolations.push(...walkDirectory(targetPath, rootDir));
    }
  }

  if (allViolations.length > 0) {
    console.error(`❌ Found ${allViolations.length} color violation(s):\n`);
    for (const v of allViolations) {
      console.error(`  ${v.file}:${v.line} - [${v.match}]`);
      console.error(`    Rule: ${v.rule}`);
      console.error(`    Line: ${v.preview}\n`);
    }
    console.error("Please replace all hardcoded colors with CSS variables (e.g. var(--token)).");
    process.exit(1);
  }

  console.log("✅ Zero hardcoded colors found! All colors adhere to semantic design tokens.");
  process.exit(0);
}

main();
