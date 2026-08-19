# SecSource Findings / Evidence Trace — Design QA

## Evidence

- Source visual truth: `/home/aioz-bang/.codex/generated_images/01a01842-04cb-7f43-a7be-0f84134bfbe3/exec-4050a312-85da-4e39-8cc9-3cfef26f1ce6.png`
- Source pixels: 1586 × 992, normalized with Lanczos to 1440 × 900 for comparison.
- Implementation screenshot: `tests/e2e/dashboard.spec.ts-snapshots/finding-evidence-chromium-linux.png`
- Implementation pixels/CSS viewport: 1440 × 900 at device scale factor 1.
- Full-view comparison: `design-qa/evidence-trace-comparison-1440.png`
- Focused trace comparison: `design-qa/evidence-trace-focused-1440.png`
- State: JobCV Frontend / CVE-2026-25639 / Evidence trace / step 2 selected / clipboard feedback cleared.

## Findings

No actionable P0, P1, or P2 differences remain.

- Typography: Existing SecSource sans/mono families and weights are preserved. The CVE is now the dominant H1, while trace labels, paths, badges, and secondary copy follow the source hierarchy.
- Spacing and layout: The dedicated detail route uses the approved full-width composition. At 1440 and 1280 the trace is a roughly 65/35 timeline/inspector split; all four fixture points and the inspector actions fit without horizontal overflow. At 940 the component becomes one column and the page still has no horizontal overflow.
- Colors and tokens: Graphite surfaces, off-white text, restrained lime selection/action, severity orange, 4/3/2px radii, and thin neutral borders match the approved direction.
- Assets and icons: The existing SecSource logo asset is retained and all UI icons come from the existing Lucide library. No placeholder, CSS-drawn, or rasterized UI assets were introduced.
- Copy and semantics: Evidence uses the scanner's real role, file, line, note, source, verification, and snippet availability. The UI explicitly says the ordered evidence is not a confirmed runtime call graph. Playback, pan/zoom, fake `Open source`, and inferred causal edges are absent.
- Intentional differences: The approved mockup's `Walk trace` is removed by product decision. Per-node tool badges are omitted because tool is finding-level rather than evidence-level data. The implementation is slightly denser so four evidence points remain visible at 1440 × 900.

## Interaction and Browser Checks

- Tested list filtering/pagination, list → detail, Back state restoration, scan-scoped detail, Open scan, evidence tab deep-linking, row selection, Previous/Next, clipboard copy, keyboard navigation, and invalid finding state.
- Checked Chrome-rendered views at 1440 × 900, 1280 × 900, and 940 × 900.
- At 1280 the measured trace columns were approximately 591px / 338px with no page-level horizontal overflow.
- At 940 the trace stacked to one 761px column with no page-level horizontal overflow.
- Browser console was checked; no application-origin errors were present. Observed warnings/errors came from installed Chrome extensions and were unrelated to SecSource.

## Comparison History

1. Initial implementation had three P2 issues: the detail header hierarchy differed from the mockup, four trace rows did not all fit at 1440 × 900, and the disclaimer appeared twice. The header was reordered and enlarged, trace density was tightened, and the duplicate footer disclaimer was removed.
2. Second comparison found one P2 action-hierarchy mismatch: manual `Next evidence` was visually weaker than the approved inspector. It was promoted to the lime primary action, and clipboard feedback was cleared before the visual baseline.
3. Final full-view and focused comparisons show no remaining P0/P1/P2 mismatch.

## Follow-up Polish

- P3: A future backend/editor integration could add a real source-opening action, but it should remain hidden until the wrapper exposes that capability.

final result: passed
