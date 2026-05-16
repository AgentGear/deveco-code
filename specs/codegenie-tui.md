## CodeGenie TUI (packages/opencode)

High-level notes for CodeGenie-specific terminal UI behavior. Keep this in sync when changing the listed areas.

### Onboarding (`deveco-onboarding.tsx`, `codegenie-legal.ts`, `plugin/deveco.ts`)

- First-run flow can require DevEco AI privacy acceptance (KV `codegenie_deveco_privacy_accepted`) before home is shown (`home.tsx`).
- OAuth browser login supports user cancel: `LoginCancelledError`, `devecoAuth.cancel()`, and `LoginResult.cancelled`.
- Provider list includes search/filter, API key step, and upstream-style copy.

### Banner (`banner.tsx`, `banner-logo.ts`)

- Lettermark: full `DEVECO CODE` when the terminal is wide enough; otherwise `DEVECO`; ultra-narrow viewports left-align and clip.
- Spaces in the padded logo row are rendered as horizontal stripe characters in the TUI (`scanline`); session exit stdout can use the same via `formatBannerLogoAnsiLines(..., { scanline: true })`.

### Home & tips (`home.tsx`, `feature-plugins/home/tips.tsx`)

- Home content is top-aligned; bottom `Tips` visibility matches the plugin rule `(!firstSession || !providerConnected) && !tipsHidden`.
- Tips plugin registers the toggle command; footer tips are driven from `home.tsx` (`footerRight`).

### Prompt (`prompt/index.tsx`)

- Agent name in the prompt meta row uses `theme.text` (not agent accent fade).

### Session exit (`routes/session/index.tsx`)

- Exit message includes ANSI logo lines plus `Session` / `Continue codegenie -s <session id>` hints.
