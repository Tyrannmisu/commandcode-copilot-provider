# Changelog

## 0.2.1 (2026-08-20)

### Features

- Added the `commandcode-copilot.modelDetailStyle` setting (default `auto`) to control the text shown beside model names in the model picker: `full` (long description), `compact` (short capability text such as "Vision · Thinking"), or `hidden` (name only). The full description stays available in the hover tooltip.

### Fixes

- On Linux, long detail text no longer collapses model names in the picker — `auto` shows compact capability text on Linux and the full description elsewhere.

## 0.2.0 (2026-08-20)

### Features

- Live model-catalog sync: Auto-discovers new models from the live catalog and surfaces them in the picker (marked `(fetched)`), assuming conservative defaults (vision + reasoning enabled, output estimated from the context window) until verified. Also fetches context windows for known/configured models and updates them if changes occur. Fetched once from `GET /provider/v1/models`, persisted in extension storage, and refreshed only on demand via **Command Code: Refresh Models**.
- Persisted catalog snapshot falls back to the bundled model registry when no API key is set or the sync fails.-

### Fixes

- Corrected the context window reported for every model in the catalog to match the live `context_length` served by `/provider/v1/models` (e.g. DeepSeek V4 Flash/Pro now report 1M, the GPT-5.4 family 400K, Grok 4.5/4.6 500K).
- Muse Spark 1.1 / 1.2 / 1.2 Contributor now report their real 1M context window and 128K max output tokens (previously shown as 288K context / 32K output).

## 0.1.1 (2026-08-19)

### Features

- Added `Qwen/Qwen3.8-27B` to the model catalog (262K context, vision, reasoning).

## 0.1.0 (2026-08-17)

### Features

- Initial release — Command Code for Copilot Chat provider.
- Pulls live model list from `GET /provider/v1/models` and exposes them in the Copilot Chat model picker.
- Streaming Chat Completions over the OpenAI-compatible `/provider/v1/chat/completions` endpoint.
- BYOK API key stored in VS Code SecretStorage.
- Per-model thinking effort selector (`none`, `low`, `medium`, `high`).
- Vision-capable models receive image parts natively (no proxy required).
- Optional zero-data-retention header (`x-cmdc-zdr: 1`).
