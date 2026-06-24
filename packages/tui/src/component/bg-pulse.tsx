/**
 * Background pulse renderable (DevEco no-op stub).
 *
 * Upstream OpenCode's `BgPulse` rendered a CG gradient-ring shimmer + 3-ring
 * background pulse behind the "Go upsell" retry dialog, powered by the
 * `GoUpsellArtPainter` class in `bg-pulse-render.ts` and the CG_LEFT data in
 * `logo.ts`. Both were specific to the OpenCode "Go" subscription concept and
 * the 3G gradient logo design — neither applies to DevEco Code.
 *
 * This stub keeps the `BgPulse` symbol exported so existing call sites
 * (`dialog-retry-action.tsx`) continue to compile. It renders nothing; the
 * retry dialog itself (title, message, action button, "don't show again"
 * toggle) still functions — only the decorative background animation is gone.
 *
 * If DevEco wants a branded background effect for retry dialogs in the future,
 * implement a new painter here (no dependency on the old CG_LEFT data).
 */
export function BgPulse() {
  return null
}
