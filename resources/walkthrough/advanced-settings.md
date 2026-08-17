## Advanced settings

Customize the provider from the extension settings.

- **`commandcode-copilot.baseUrl`** — point at a self-hosted mirror or proxy.
- **`commandcode-copilot.maxTokens`** — cap the output tokens per request (0 = unlimited).
- **`commandcode-copilot.zdr`** — send `x-cmdc-zdr: 1` on every request for zero-data-retention routing.
- **`commandcode-copilot.modelIdOverrides`** — remap a model id before it is sent to the API (useful when a mirror renames models).
- **`commandcode-copilot.modelBlacklist`** — hide specific models from the picker.
- **`commandcode-copilot.maxContextTokens`** — override the context window reported to Copilot (for mirrors that serve smaller windows).
- **`commandcode-copilot.debugMode`** — surface extra request metadata in the output channel.

[Open settings](command:commandcode-copilot.openSettings)
