# Architecture

## Directory Structure

```
deveco-cli/
├── packages/
│   ├── opencode/          # CLI core (Effect runtime, TUI, Agent logic)
│   ├── app/               # Web App (SolidJS frontend)
│   ├── web/               # Landing page and website
│   ├── ui/                # Shared UI component library
│   ├── desktop/           # Tauri desktop app
│   ├── desktop-electron/  # Electron desktop app (legacy)
│   ├── slack/             # Slack integration
│   ├── shared/            # Shared utilities and types
│   ├── sdk/js/            # JavaScript SDK
│   ├── plugin/            # Plugin system
│   ├── function/          # Serverless Function runtime
│   ├── enterprise/        # Enterprise features
│   ├── storybook/         # UI component documentation
│   ├── script/            # Build and release scripts
│   ├── containers/        # Docker image definitions
│   └── console/           # Cloud console (SaaS)
│       ├── app/           # Console frontend
│       ├── core/          # Console backend core
│       ├── function/      # Console serverless functions
│       ├── mail/          # Email templates
│       └── resource/      # Infrastructure resources
├── specs/                 # Feature specifications
├── docs/                  # Project documentation
│   └── upstream-sync/     # Upstream sync guides and records
├── github/                # GitHub Action release scripts
├── infra/                 # Infrastructure as Code (SST / AWS)
├── nix/                   # Nix packaging config
├── sdks/                  # SDK related (including VS Code extension)
└── .opencode/             # OpenCode self-configuration
```

## Sub-package Spec Index

- [packages/opencode/AGENTS.md](packages/opencode/AGENTS.md)
- [packages/app/AGENTS.md](packages/app/AGENTS.md)
- [packages/desktop/AGENTS.md](packages/desktop/AGENTS.md)
- [packages/desktop-electron/AGENTS.md](packages/desktop-electron/AGENTS.md)
