# Multi-Provider Gateway Hub (Market Router)

This repository now includes a runnable gateway scaffold under `src/gateway/`.

## What it does

- **Adapter interface** for plugging in multiple agent providers (Claude/Gemini/Copilot/Codex/custom)
- **Market-based router** that asks each adapter for a bid and allocates work by utility
- **Policy engine** to enforce budget/latency/risk/quality guardrails
- **Event log** (`jsonl`) for deterministic replay and auditability
- **Claude swarm bridge** to mirror gateway decisions into native Task/Mailbox surfaces

## Files

- `src/gateway/types.ts` — canonical task/bid/config/event types
- `src/gateway/adapters/Adapter.ts` — adapter contract
- `src/gateway/adapters/CommandAgentAdapter.ts` — command-based adapter
- `src/gateway/market.ts` — utility scoring + second-price-like clearing
- `src/gateway/policyEngine.ts` — deterministic policy checks
- `src/gateway/router.ts` — allocation logic
- `src/gateway/eventLog.ts` — append-only event sink
- `src/gateway/hub.ts` — orchestrator
- `src/gateway/cli.ts` — CLI entrypoint
- `src/gateway/bridges/claudeSwarmBridge.ts` — integration layer to TaskCreate/TaskUpdate/Mailbox
- `src/gateway/strengths.ts` — provider strength boosting (Claude-native strengths)

## Config example

```yaml
eventLogPath: ./.gateway/events.jsonl
risk:
  maxRiskScore: 0.7
  minQualityScore: 0.4
claudeBridge:
  enabled: true
  teamName: market-team
  leaderName: team-lead
  mirrorToTasks: true
  mirrorToMailbox: true
agents:
  - id: claude-runner
    provider: claude
    capabilities: [analyze, implement, test]
    baseCostPer1kTokensUsd: 0.01
    historicalQuality: 0.82
    riskScore: 0.25
    maxParallelTasks: 2
    command: bash
    args: ["-lc", "echo '[claude-runner] executed'"]

  - id: codex-runner
    provider: codex
    capabilities: [analyze, implement, review]
    baseCostPer1kTokensUsd: 0.008
    historicalQuality: 0.78
    riskScore: 0.30
    maxParallelTasks: 2
    command: bash
    args: ["-lc", "echo '[codex-runner] executed'"]
```

## Run

```bash
bun src/gateway/cli.ts --config gateway.yaml --prompt "Refactor task queue and add tests"
```

or through main CLI:

```bash
claude gateway --config gateway.yaml --prompt "Refactor task queue and add tests"
```

## Bridge behavior

When `claudeBridge.enabled` is true, gateway events are mirrored to Claude-native
coordination surfaces:

- `task_received` -> creates a Claude task item
- `allocation_decided` -> task owner/status update + mailbox notifications
- `task_executed` -> task completion + mailbox completion note
- `policy_blocked` -> task cancellation + mailbox explanation
