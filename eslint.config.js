// Minimal ESLint flat config. Install dev deps first: `npm i`, then `npm run lint`.
// Cross-file globals (defined in i18n.js, used in popup/background) would make
// no-undef noisy, so it's off; the value here is catching unused vars, accidental
// reassignment, and loose equality.
const sharedGlobals = {
  window: "readonly", document: "readonly", navigator: "readonly",
  location: "readonly", parent: "readonly", fetch: "readonly",
  URLSearchParams: "readonly", Intl: "readonly", console: "readonly",
  setTimeout: "readonly", clearTimeout: "readonly",
  setInterval: "readonly", clearInterval: "readonly",
  ResizeObserver: "readonly", chrome: "readonly", importScripts: "readonly",
  Platform: "readonly", globalThis: "readonly"
};

module.exports = [
  {
    // Generated sync-core outputs + non-core tooling are not linted as sources.
    ignores: [
      "dist/**", "node_modules/**", "backend/**", "tools/**", "scripts/**",
      "targets/extension/build/**", "targets/desktop/src/**", "targets/mobile/www/**", "targets/web/build/**",
      "core/platform/vendor/**", // vendored third-party (adhan, tz-lookup)
      "targets/mobile/android/**", "targets/desktop/src-tauri/**" // generated native projects
    ]
  },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: sharedGlobals },
    rules: {
      "no-unused-vars": ["warn", { args: "none" }],
      "no-undef": "off",
      "prefer-const": "warn",
      eqeqeq: ["warn", "smart"]
    }
  },
  {
    // Lazily imported ES modules (each shell's adapter.js loads them on first use).
    // speech-web.js is shared by the extension and the desktop app.
    files: [
      "core/platform/speech-web.js",
      "targets/web/google-auth-web.js",
      "targets/extension/google-auth-chrome.js",
      "targets/desktop/web/google-auth-desktop.js"
    ],
    languageOptions: { sourceType: "module", globals: { ...sharedGlobals, crypto: "readonly", atob: "readonly" } }
  },
  {
    // Architectural guard: core/ must be platform-agnostic. Platform calls
    // (chrome.*) belong only in the per-target adapters under targets/.
    files: ["core/**/*.js"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "chrome",
          message:
            "core/ must stay platform-agnostic — use Platform.* (chrome.* belongs in targets/<shell> adapters)."
        }
      ]
    }
  }
];
