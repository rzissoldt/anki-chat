# Anki Chat

Slim self-hosted assistant UI for a vLLM model and external MCP tools.
`anki-chat` hosts the server-side agent loop; vLLM provides inference and the
external MCP server provides tools.

## Architecture

```text
Browser
  │
  ▼
anki-chat /api/chat
  ├── vLLM /v1/chat/completions
  └── external MCP /mcp
        ↑
        └── tool calls and results loop until the model answers
```

## Development

```bash
cp .env.example .env
# Configure the complete vLLM Chat Completions URL and model:
# CHAT_API_URL=http://localhost:8001/v1/chat/completions
# CHAT_MODEL=qwen38-chat
#
# Configure a running Streamable HTTP MCP server:
# MCP_SERVER_URL=http://localhost:8002/mcp

make setup
make dev
```

Open [http://localhost:3000](http://localhost:3000).

## Production

```bash
cp .env.example .env
# Configure .env, then:
make up
make logs
```

Stop the deployment with `make down`. The Docker build downloads CC-CEDICT and
HanDeDict before compiling the application, so a clean checkout does not need
local dictionary files. Anki vocabulary remains external and is fetched from
the configured MCP service at runtime.

## Scripts

```bash
make help
make lint
make typecheck
make test
make build
make dict-download
```

`dict:download` refreshes the local dictionaries at `data/cedict_ts.u8`
(Chinese-English) and `data/handedict.u8` (Chinese-German). Chat remains
independent from the dictionary endpoint, but hover definitions are unavailable
when these files are missing. Chinese hover definitions use local dictionaries only
(`jieba-wasm` + CC-CEDICT / HanDeDict). Production-mode German or English
practice lines get a separate short vLLM structured-output call after the
assistant message finishes streaming (thinking disabled) so glosses match
sentence context. Gloss language is chosen with a cheap heuristic over
recent user messages (`de` → HanDeDict for Chinese glosses / German prompts,
otherwise CC-CEDICT). If the contextual gloss call fails, German hover
segments are omitted rather than falling back to reverse dictionary lookup.

Downloaded dictionary files are ignored by Git and excluded from the Docker
build context. The image always obtains them through the download script.

## Configuration

- `CHAT_API_URL` (required): complete OpenAI-compatible Chat Completions URL.
- `CHAT_MODEL` (required): model ID served by vLLM.
- `CHAT_API_KEY` (optional): model API key.
- `CHAT_ENABLE_THINKING` (optional): sends
  `chat_template_kwargs.enable_thinking` to vLLM; defaults to `true`.
  Skipped automatically for Gemini’s OpenAI-compatible host
  (`generativelanguage.googleapis.com`), which rejects that field.
- `CHAT_AUTH_HEADER` / `CHAT_AUTH_SCHEME` (optional): custom model auth.
- `MCP_SERVER_URL` (optional): external Streamable HTTP MCP endpoint. Without
  it, chat still works without tools.
- `MCP_AUTH_TOKEN` (optional): bearer token for the MCP endpoint.
- `MCP_TIMEOUT_MS` (optional): MCP initialization and request timeout;
  defaults to 15000.
- `AGENT_MAX_STEPS` (optional): maximum model/tool rounds; defaults to 10.
- `STT_API_URL`, `STT_API_KEY`, `STT_MODEL`, `STT_LANGUAGE` (optional):
  OpenAI-compatible speech-to-text service.
- `TTS_API_URL`, `TTS_API_KEY`, `TTS_MODEL`, `TTS_VOICE` (optional):
  OpenAI-compatible text-to-speech service.
- `NEXT_PUBLIC_APP_NAME`, `NEXT_PUBLIC_ENABLE_STT`,
  `NEXT_PUBLIC_ENABLE_TTS` (optional): non-secret UI settings.

Secrets must never use the `NEXT_PUBLIC_` prefix.

## Health

`GET /api/health` returns `{ status: "ok", features: { ... } }` without secrets or upstream URLs.

## Notes

- Chat history stays in the browser.
- A fresh MCP client is opened per chat request and closed after completion or
  cancellation.
- The configured MCP service must actually expose a Streamable HTTP endpoint.
  A repository or CLI without a running `/mcp` endpoint cannot be connected.
- vLLM must support automatic tool choice for the selected model. Start it with
  the matching tool-call parser (for many Qwen models this is the Hermes parser)
  and automatic tool choice enabled; otherwise vLLM may reject `tools` or return
  tool calls as plain text.
- STT transcripts are inserted into the composer and are **not** auto-sent.
- TTS speaks finished assistant messages only; no sentence streaming in the MVP.
- If `STT_API_URL` / `TTS_API_URL` are unset, those controls stay hidden.

## Dictionary data

Hover definitions:

- Chinese: local dictionaries only — [CC-CEDICT](https://www.mdbg.net/chinese/dictionary?page=cc-cedict) (EN),
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/);
  [HanDeDict](https://github.com/gugray/HanDeDict) (DE),
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/)
- Production L1 practice lines: short structured-output call on the configured
  chat model (contextual German/English → Chinese)

Chinese words look up forward (headword → gloss).
Lookup requests do not call an external service for Chinese segmentation;
contextual L1 glosses use the configured chat model only.
