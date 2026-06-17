# @design-embed/vanjs

## 2.0.0

### Patch Changes

- fc26153: Refactor: split monolithic `index.ts` into focused modules (`utils`, `styles`, `nodes`, `emit`, `generateTests`, `target`) in the react, vue, and vanjs packages. No behaviour change.
- Updated dependencies [53f9b59]
- Updated dependencies [538397e]
  - design-embed@0.5.0

## 1.0.0

### Minor Changes

- 7f65bd6: Add opt-in heuristic component auto-detection via the new `detect` config option (off by default).

  When enabled with `detect: true` (or `detect: { componentsDir, minOccurrences, minSubtreeSize }`), design-embed rewrites parsed HTML into component nodes without manual `components` mappings. It runs deterministically per source and (1) maps HTML to your existing hand-written components scanned from `componentsDir`, referencing them without re-generating their files, and (2) synthesizes new components from repeated structures, parameterizing the parts that vary across repeats as props (including nested slots). Manual `components` mappings always take precedence, and an existing-component match wins over synthesis. Configs without `detect` are unaffected.

- b91e55d: Rename `plugin` to `source` in `SourceConfig`; move `styleMode` into target constructors

  **Breaking changes:**

  - `SourceConfig.plugin` is renamed to `SourceConfig.source`. Update all config files:
    ```diff
    - sources: [{ plugin: fromFile("./design.html"), output: { viewName: "Hero" } }]
    + sources: [{ source: fromFile("./design.html"), output: { viewName: "Hero" } }]
    ```
  - `styleMode` is removed from `GlobalOutputConfig` and `SourceOutputConfig`. Pass it to the target constructor instead:
    ```diff
    - output: { target: new ReactTarget(), styleMode: "css-modules" }
    + output: { target: new ReactTarget({ styleMode: "css-modules" }) }
    ```
    `ReactTarget`, `VanJsTarget`, and `VueTarget` each accept `{ styleMode?: "inline" | "css-modules" | "tailwind" }` (default: `"inline"`).
  - `SourcePlugin.name` is now optional, so inline source objects no longer require a `name` field.

### Patch Changes

- e2c4471: Fix visual regression snapshot initialization failing on new platforms (e.g., Linux CI). The init branch now writes the baseline PNG directly via `writeFileSync` instead of calling `toHaveScreenshot`, which Playwright always fails when the snapshot file doesn't exist.
- 018f91a: Fix visual regression snapshot init to use component rendering instead of reference HTML.

  The snapshot baseline is now captured by mounting the component itself (via `mount()` in
  Playwright CT) rather than by calling `page.setContent(referenceHtml)`. This eliminates
  a systematic pixel-dimension mismatch that occurred because `page.setContent()` and the CT
  mount render in different browser contexts, causing consistent height differences that
  exceeded the `maxDiffPixels` threshold.

  Additional fixes:

  - `e2e/target-react.test.ts` now cleans the `generated/` directory before running `embed()`,
    preventing stale spec files from old code versions from persisting across runs.
  - `screenshotOptions.ts` `buildHeadlessBeforeAll` now prefixes source HTML with `<!DOCTYPE html>`
    so headless snapshot capture renders in Standards Mode (matching the test page context).

- 677c5b9: Add multi-source config schema and visual snapshot types.

  Introduces `sources` array, per-source `SourceConfig`, `SnapshotConfig`, and `resolveConfig()` with defaults. Adds `snapshotPath` to `TargetTestGenerateInput`. The old `source` field is deprecated with a runtime warning but continues to work.

- Updated dependencies [7f65bd6]
- Updated dependencies [03d5e18]
- Updated dependencies [018f91a]
- Updated dependencies [e2c4471]
- Updated dependencies [0af3701]
- Updated dependencies [677c5b9]
- Updated dependencies [941bf27]
- Updated dependencies [b91e55d]
  - design-embed@0.4.0

## 0.2.0

### Minor Changes

- 1ed5bd9: Rename packages to @design-embed/<name> and update package directory structure to packages/<name>.

### Patch Changes

- 618a895: Simplify emitted visual regression tests to use Playwright's native `toHaveScreenshot` matching instead of custom layout/pixelmatch checks.
