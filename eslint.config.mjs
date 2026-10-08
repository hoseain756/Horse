import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";
import { dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// harbor-ui/no-literal-ui-string — lint guard for the i18n system (defect G).
// Flags JSX text with ≥2 Latin words that is NOT run through the i18n system.
// Allow-list (by design): brand names, URLs/hosts, codec/tech names, units,
// single words, and numbers. A file can opt out with a `harbor-i18n-allow`
// comment (used for player-internal technical labels).
// Severity: "warn" — surfaces debt without blocking builds.
// ---------------------------------------------------------------------------
const BRAND_RE =
  /\b(Harbor|Horse|Stremio|TMDB|Trakt|Simkl|AniList|MyAnimeList|Kitsu|Cinemeta|OpenSubtitles|Debrid|IMDb|YouTube|mkv|MKV|HEVC|H\.264|AAC|AC3|DTS|AV1|FFprobe|ffmpeg|API|ID|URL|PKCE|PWA|MIT|OK)\b/;
const URLISH_RE = /^(https?:\/\/|\S+\.\S+\/|github\.com)/i;

function noLiteralUiString(context) {
  return {
    JSXText(node) {
      const raw = node.value.trim();
      if (!raw) return;
      // Single word, numbers, units, symbols → allowed
      if (!/\s/.test(raw)) return;
      // Must contain at least 2 Latin words to be a UI sentence
      const words = raw.split(/\s+/).filter((w) => /[A-Za-z]{2,}/.test(w));
      if (words.length < 2) return;
      // Allow-list: contains a brand/tech token, or is a URL-ish string
      if (BRAND_RE.test(raw)) return;
      if (URLISH_RE.test(raw)) return;
      // File-level opt-out
      const src = context.sourceCode.getText();
      if (src.includes("harbor-i18n-allow")) return;
      context.report({
        node,
        message:
          'Literal UI string in JSX — move it to the i18n dictionary (lib/harbor/i18n.ts) or wrap with t(). Offending text: "' +
          (raw.length > 60 ? raw.slice(0, 60) + "…" : raw) +
          '"',
      });
    },
  };
}

const i18nPlugin = {
  plugins: {
    "harbor-ui": {
      rules: {
        "no-literal-ui-string": {
          meta: { type: "suggestion", docs: { description: "Flag literal UI sentences in JSX (i18n)" }, schema: [] },
          create: noLiteralUiString,
        },
      },
    },
  },
};

const eslintConfig = [...nextCoreWebVitals, ...nextTypescript, {
  plugins: { "harbor-ui": i18nPlugin.plugins["harbor-ui"] },
  rules: {
    // TypeScript rules
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-unused-vars": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/ban-ts-comment": "off",
    "@typescript-eslint/prefer-as-const": "off",
    "@typescript-eslint/no-unused-disable-directive": "off",

    // React rules
    "react-hooks/exhaustive-deps": "off",
    "react-hooks/purity": "off",
    "react/no-unescaped-entities": "off",
    "react/display-name": "off",
    "react/prop-types": "off",
    "react-compiler/react-compiler": "off",

    // Next.js rules
    "@next/next/no-img-element": "off",
    "@next/next/no-html-link-for-pages": "off",

    // General JavaScript rules
    "prefer-const": "off",
    "no-unused-vars": "off",
    "no-console": "off",
    "no-debugger": "off",
    "no-empty": "off",
    "no-irregular-whitespace": "off",
    "no-case-declarations": "off",
    "no-fallthrough": "off",
    "no-mixed-spaces-and-tabs": "off",
    "no-redeclare": "off",
    "no-undef": "off",
    "no-unreachable": "off",
    "no-useless-escape": "off",

    // i18n guard (defect G): literal UI sentences in JSX are flagged
    "harbor-ui/no-literal-ui-string": "warn",
  },
}, {
  ignores: ["node_modules/**", ".next/**", "out/**", "build/**", "next-env.d.ts", "examples/**", "skills", ".crawl/**", "download/**"]
}];

export default eslintConfig;
