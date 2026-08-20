# Command Code for Copilot Chat

Access Command Code models directly inside Copilot Chat — no new UI, no workflow changes.

**Already enjoying Command Code's pricing but missing Copilot's agent capabilities, tool integrations, and familiar interface?** This extension brings the entire Command Code model lineup into the Copilot Chat model selector, complete with **image understanding**, **adjustable reasoning depth**, and secure API key management.

## Why use this?

- **Extend Copilot, don't replace it.** There's no extra sidebar or interface to figure out — just additional models appearing in the dropdown you already know.
- **Full Copilot feature support.** Agent workflows, tool execution, custom instructions, MCP servers, and skills all continue to work seamlessly on Command Code models.
- **Direct image understanding.** Models from Claude, GPT, Gemini, Kimi, Qwen, and Grok handle image inputs natively through Command Code — no intermediate proxy or re-encoding step.
- **Bring your own key.** You control the billing, rate limits, and account. Credentials are persisted in the OS keychain, never written to config files or version control.

## Capabilities

### Complete model catalog in the picker

Every model available through Command Code's provider API appears right next to built-in options in the Copilot Chat selector — including Claude Opus 5, Claude Sonnet 5, GPT-5.5/5.6, Gemini 3.7 Flash, DeepSeek V4 Pro/Flash, Kimi K3, Qwen 3.8 Max, GLM-5.3, Grok 4.6, and many others. You can swap models in the middle of a conversation without resetting context.

### Live model discovery

The extension fetches the current model catalog from Command Code **once**, persists it locally, and only contacts the API again when you run **Command Code: Refresh Models** — there's no periodic background traffic.

- **Context stays accurate** — every model's reported context window mirrors the live `context_length` from the provider API.
- **New models appear automatically** — when Command Code ships a model that isn't in the bundled registry yet, it shows up in the picker on its own. Auto-discovered entries are suffixed with **"(fetched)"** so you can tell them apart.
- **Conservative defaults** — until a model is verified and added to the registry in [`src/models.ts`](src/models.ts), auto-discovered entries assume vision support, reasoning/thinking enabled, tool calling on, and an estimated output budget of ⅛ of the context window (capped at 128K tokens).

### Per-model reasoning control

Models that support extended reasoning display a **Thinking effort** selector right inside the Copilot interface:

- `Off` — skip reasoning entirely for maximum speed
- `Light` — minimal reasoning suited to quick adjustments
- `Standard` — balanced reasoning for general-purpose use
- `Deep` — thorough reasoning aimed at challenging problems

This preference is forwarded to the upstream provider as `reasoning_effort` and scoped to the currently selected model — no separate global configuration needed.

<p align="center">
  <img src="resources/screenshots/picker.png" alt="Command Code models in the Copilot Chat model picker with per-model Thinking effort dropdowns" width="800">
</p>

### Image input support

Models with vision capabilities (Claude Opus/Sonnet 5, GPT-5.4+, Gemini, Kimi K3, Qwen 3.7+, Grok 4.5, and others) accept image attachments directly in the conversation — no encoding workaround, no added round-trip delay.

### Full Copilot integration

Since this extension registers through Copilot's built-in provider interface, every native capability remains available:

- **Agent mode** — handle complex, multi-step workflows autonomously
- **Tool calling** — edit files, run terminal commands, search the workspace, interact with Git, execute tests
- **Instructions & skills** — your `.instructions.md`, `AGENTS.md`, and custom skills continue to function normally
- **Zero-data-retention** — enable with a single toggle; traffic is directed exclusively through ZDR-compliant endpoints

### Credential security

API keys are stored using VS Code's `SecretStorage`, which leverages the operating system's native keychain (Windows Credential Manager, macOS Keychain, Linux Secret Service). Keys are never persisted in `settings.json` or exposed through version control.

### No added dependencies

Built entirely on VS Code's extension API and Node.js standard library. There's no reliance on Python runtimes, Docker containers, or locally hosted proxy servers.

## Getting Started

### What you need

- VS Code version 1.116 or newer (the extension uses the same provider API surface that powers Copilot Chat)
- An active GitHub Copilot subscription (Free, Pro, or Enterprise tiers all work — including the free plan)
- A Command Code subscription with API access enabled (GOAT, Pro, Max, Team, or Provider tiers) — details on the [pricing page](https://commandcode.ai/docs/resources/pricing-limits)

### Install

1. **VS Code** — grab it from the [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=Tyrannmisu.commandcode-copilot-provider).
2. **Other editors on Open VSX** — available on [Open VSX](https://open-vsx.org/extension/Tyrannmisu/commandcode-copilot-provider).

### First steps

1. Open the Command Palette (`Ctrl+Shift+P`) and run **Command Code: Set API Key**.
2. Enter your Command Code API key (generate one at [Studio](https://commandcode.ai/studio/)).
3. Launch Copilot Chat, open the model dropdown, and select a **Command Code** model.
4. Optionally adjust the **Thinking effort** level via the control beside the model name.
5. Start chatting.

## Available models

The extension surfaces the full Command Code provider lineup, organized by vendor. Here are some highlights:

| Model                | Reasoning levels              | Vision | Ideal use case                              |
| -------------------- | ----------------------------- | ------ | ------------------------------------------- |
| **Claude Sonnet 5**  | Off / Light / Standard / Deep | ✅     | Strong balance of speed and capability      |
| **Claude Opus 5**    | Off / Light / Standard / Deep | ✅     | Highest-capability Anthropic model          |
| **GPT-5.6-Luna**     | Off / Light / Standard / Deep | ✅     | Optimized for cost-sensitive workloads      |
| **Gemini 3.7 Flash** | Off / Light / Standard / Deep | ✅     | Fast coding and agent-oriented tasks        |
| **DeepSeek V4 Pro**  | Off / Light / Standard / Deep | —      | Long-context reasoning via hybrid attention |
| **Qwen 3.7 Plus**    | Off / Light / Standard / Deep | ✅     | Cost-effective agentic development          |
| **Kimi K3**          | Off / Light / Standard / Deep | ✅     | 1M-token context for knowledge-heavy work   |
| **Grok 4.5**         | Off / Light / Standard / Deep | ✅     | xAI's top model for development tasks       |
| **GLM-5.3**          | Off / Light / Standard / Deep | —      | Frontier reasoning with 1M context          |

Over 50 models from 17 different providers are included — see the complete catalog in [`src/models.ts`](src/models.ts). Models Command Code adds after a release appear automatically in the picker, marked **(fetched)**.

## Extension settings

| Setting                                | Default                                  | Purpose                                                                                                                                    |
| -------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `commandcode-copilot.baseUrl`          | `https://api.commandcode.ai/provider/v1` | Base URL for API calls — override for self-hosted setups or reverse proxies                                                                |
| `commandcode-copilot.maxTokens`        | `0`                                      | Cap on output tokens per response (`0` = unlimited). Handy for managing costs                                                              |
| `commandcode-copilot.zdr`              | `false`                                  | Attach `x-cmdc-zdr: 1` header to enforce zero-data-retention endpoint routing                                                              |
| `commandcode-copilot.modelIdOverrides` | `{}`                                     | Remap VS Code model identifiers to alternate API identifiers (useful for mirrored deployments)                                             |
| `commandcode-copilot.modelBlacklist`   | `[]`                                     | Exclude specific model identifiers from appearing in the selector                                                                          |
| `commandcode-copilot.maxContextTokens` | `0`                                      | Override the context window size reported to Copilot (`0` = keep the model's native default)                                               |
| `commandcode-copilot.modelDetailStyle` | `auto`                                   | Text shown beside model names: `auto` (compact on Linux, full elsewhere), `full`, `compact` (`Vision · Thinking`), or `hidden` (name only) |
| `commandcode-copilot.apiKey`           | _(unset)_                                | Fallback API key location (settings-based; SecretStorage takes precedence when both are set)                                               |
| `commandcode-copilot.debugMode`        | `minimal`                                | Logging detail: `minimal` (quiet), `metadata` (per-call summary), `verbose` (full request/response)                                        |

Reasoning depth is adjusted per model through the Copilot Chat model selector.

Sample `settings.json` for a mirrored endpoint that uses alternate model names:

```json
{
  "commandcode-copilot.baseUrl": "https://my-mirror.example.com/v1",
  "commandcode-copilot.modelIdOverrides": {
    "claude-sonnet-5": "claude-sonnet-5-mirror",
    "gpt-5.5": "gpt-5-5-mirror"
  }
}
```

Sample `settings.json` with zero-data-retention enabled:

```json
{
  "commandcode-copilot.zdr": true
}
```

## License

[MIT](LICENSE)
