# Changelog

## 0.1.0 (2026-08-17)

### Features

- Initial release — Command Code for Copilot Chat provider.
- Pulls live model list from `GET /provider/v1/models` and exposes them in the Copilot Chat model picker.
- Streaming Chat Completions over the OpenAI-compatible `/provider/v1/chat/completions` endpoint.
- BYOK API key stored in VS Code SecretStorage.
- Per-model thinking effort selector (`none`, `low`, `medium`, `high`).
- Vision-capable models receive image parts natively (no proxy required).
- Optional zero-data-retention header (`x-cmdc-zdr: 1`).
