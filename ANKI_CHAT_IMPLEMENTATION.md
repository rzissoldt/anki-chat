# anki-chat — Implementation Plan

> Ziel: Ein schlankes, selbst gehostetes Chat-Frontend für die bestehende Sprachlern-/Anki-Infrastruktur auf Basis von **Next.js + assistant-ui**.
>
> **Wichtig:** Chat/LLM, STT und TTS existieren bereits als externe Services. Dieses Projekt implementiert **keinen** eigenen LLM-, STT-, TTS- oder MCP-Server. `anki-chat` ist ausschließlich UI + dünne Proxy-/Adapter-Schicht.

---

## 1. Zielbild

Das Projekt soll sich wie ein sehr reduziertes ChatGPT/LibreChat verhalten:

- genau **ein Chatfenster**
- keine Userverwaltung
- keine Registrierung / Anmeldung
- kein Model-Selector
- keine Provider-Konfiguration im UI
- kein Admin-Panel
- keine Knowledge-Base
- keine unnötigen Sidebar-Features
- Chat-Streaming
- sichtbares Reasoning / Thinking, sofern der Chat-Endpoint es liefert
- sichtbare Tool-Calls, sofern der Chat-Endpoint sie liefert
- STT über bereits vorhandenen STT-Endpoint
- TTS über bereits vorhandenen TTS-Endpoint
- mobil und Desktop nutzbar
- Docker-fähig
- Services ausschließlich über Environment-Variablen konfigurierbar

Das UI soll bewusst dünn bleiben.

```text
Browser
  │
  ▼
anki-chat / Next.js
  │
  ├── /api/chat ─────────► EXISTING CHAT ENDPOINT
  │                         └── LLM / Agent / MCP läuft extern
  │
  ├── /api/stt ──────────► EXISTING STT ENDPOINT
  │
  └── /api/tts ──────────► EXISTING TTS ENDPOINT
```

Die Next.js-Routen sind **Server-Proxies**.

Der Browser soll die externen Service-URLs oder API-Keys niemals kennen müssen.

---

# 2. Bestehendes Projekt

Das Repository existiert bereits und heißt:

```text
anki-chat
```

Der implementierende Agent soll **zuerst das bestehende Repository analysieren**, bevor Dateien ersetzt oder neu erzeugt werden.

Insbesondere prüfen:

- vorhandenes `package.json`
- verwendeter Package Manager (`pnpm`, `npm`, `bun`, ...)
- vorhandene Next.js-Version
- App Router vs. Pages Router
- vorhandene assistant-ui-Komponenten
- vorhandenes Tailwind/shadcn Setup
- vorhandene `.env*`
- vorhandene Docker-Dateien
- vorhandene API-Routen

Bestehende sinnvolle Struktur weiterverwenden.

Nicht unnötig ein zweites Next.js-Projekt im Repository erzeugen.

---

# 3. Technischer Stack

Bevorzugt:

```text
Next.js
TypeScript
React
assistant-ui
Tailwind CSS
shadcn/ui
```

Für assistant-ui aktuelle APIs verwenden.

Keine veralteten assistant-ui APIs verwenden, wenn es dafür inzwischen Toolkit-/Runtime-APIs gibt.

Referenz:

- https://www.assistant-ui.com/docs
- https://www.assistant-ui.com/docs/runtimes/custom/overview
- https://www.assistant-ui.com/docs/tools
- https://www.assistant-ui.com/docs/guides/speech

---

# 4. Architekturprinzip

## 4.1 Frontend

assistant-ui verwaltet:

- Conversation UI
- Message Rendering
- Streaming-Zustand
- Stop/Cancel
- Retry/Regenerate, sofern sinnvoll
- Reasoning Darstellung
- Tool-Call Darstellung
- Composer

Eigene Komponenten ergänzen nur:

- Mikrofon-Button
- Aufnahmezustand
- TTS-/Play-Button
- Tool-Fallback-Renderer
- ggf. Reasoning Renderer
- Fehlerzustände

---

## 4.2 Server-Proxies

Es sollen folgende lokalen Endpoints existieren:

```text
POST /api/chat
POST /api/stt
POST /api/tts
```

Diese Routen rufen die bereits existierenden externen Services auf.

### Warum Proxy?

- API-Key bleibt serverseitig
- keine CORS-Probleme
- einheitliche Fehlerbehandlung
- Upstream-Protokolle können normalisiert werden
- externe URLs sind austauschbar
- Browser kennt Infrastruktur nicht
- später Auth vor externen Services möglich

---

# 5. Environment-Konfiguration

Eine `.env.example` anlegen.

Mindestens:

```dotenv
# --------------------------------------------------
# CHAT
# --------------------------------------------------

CHAT_API_URL=http://host.docker.internal:8000/v1/chat/completions
CHAT_API_KEY=
CHAT_MODEL=
CHAT_PROTOCOL=openai-compatible

# Optional custom Authorization header behavior
CHAT_AUTH_HEADER=Authorization
CHAT_AUTH_SCHEME=Bearer

# --------------------------------------------------
# STT
# --------------------------------------------------

STT_API_URL=http://host.docker.internal:8001/v1/audio/transcriptions
STT_API_KEY=
STT_MODEL=whisper-large-v3
STT_PROTOCOL=openai-compatible

# Optional default language.
# Leave empty for autodetection.
STT_LANGUAGE=

# --------------------------------------------------
# TTS
# --------------------------------------------------

TTS_API_URL=http://host.docker.internal:8002/v1/audio/speech
TTS_API_KEY=
TTS_MODEL=
TTS_VOICE=
TTS_FORMAT=mp3
TTS_PROTOCOL=openai-compatible

# --------------------------------------------------
# UI
# --------------------------------------------------

NEXT_PUBLIC_APP_NAME=Anki Chat
NEXT_PUBLIC_ENABLE_REASONING=true
NEXT_PUBLIC_ENABLE_TOOL_CALLS=true
NEXT_PUBLIC_ENABLE_STT=true
NEXT_PUBLIC_ENABLE_TTS=true

# Optional
NEXT_PUBLIC_AUTO_PLAY_TTS=false
```

Wichtig:

**Secrets niemals als `NEXT_PUBLIC_*` definieren.**

---

# 6. Config-Modul

Zentrale serverseitige Config erzeugen:

```text
src/lib/config.ts
```

oder zur bestehenden Struktur passend.

Dort:

- env vars validieren
- sinnvolle Defaults definieren
- klare Fehlermeldung bei fehlender `CHAT_API_URL`
- Feature Flags bereitstellen

Optional `zod` verwenden.

Beispielkonzept:

```ts
export const config = {
  chat: {
    url: process.env.CHAT_API_URL!,
    apiKey: process.env.CHAT_API_KEY,
    model: process.env.CHAT_MODEL,
    protocol: process.env.CHAT_PROTOCOL ?? "openai-compatible",
  },
  stt: {
    url: process.env.STT_API_URL,
    apiKey: process.env.STT_API_KEY,
    model: process.env.STT_MODEL,
    language: process.env.STT_LANGUAGE,
  },
  tts: {
    url: process.env.TTS_API_URL,
    apiKey: process.env.TTS_API_KEY,
    model: process.env.TTS_MODEL,
    voice: process.env.TTS_VOICE,
    format: process.env.TTS_FORMAT ?? "mp3",
  },
};
```

---

# 7. Chat-Integration

## 7.1 Wichtigste Anforderung

Der bestehende Chat-Endpoint ist die Quelle der Wahrheit.

`anki-chat` soll keinen zweiten Agent-Loop implementieren.

Insbesondere:

```text
NICHT:
Frontend -> Next.js -> eigener Agent -> LLM

SONDERN:
Frontend -> Next.js Proxy/Adapter -> bestehender Chat-/Agent-Endpoint
```

Wenn der externe Chat-Endpoint bereits:

- MCP ausführt
- mehrere Tool-Calls hintereinander ausführt
- Context verwaltet
- Reasoning liefert

dann soll `anki-chat` diese Informationen **nur streamen und darstellen**.

---

# 8. Chat-Protokoll abstrahieren

Eine Adapter-Grenze implementieren.

Empfohlene Struktur:

```text
src/lib/chat/
  types.ts
  adapter.ts
  openai-compatible.ts
```

Interface sinngemäß:

```ts
export interface ChatAdapter {
  stream(request: ChatRequest, signal?: AbortSignal): Promise<Response>;
}
```

Dadurch kann später ein anderes Backend-Protokoll ergänzt werden, ohne das Frontend umzubauen.

Für Phase 1:

```text
CHAT_PROTOCOL=openai-compatible
```

implementieren.

Wenn das real vorhandene Chat-Backend ein abweichendes Format nutzt, **nur den Adapter anpassen**, nicht assistant-ui Komponenten mit Backend-Sonderfällen verunreinigen.

---

# 9. Internes normalisiertes Chat-Event-Modell

Das UI darf nicht direkt von provider-spezifischen SSE-Chunks abhängen.

Intern soll mindestens zwischen folgenden Ereignissen unterschieden werden:

```ts
type NormalizedChatEvent =
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; text: string }
  | {
      type: "tool-call-start";
      toolCallId: string;
      toolName: string;
      args?: unknown;
    }
  | {
      type: "tool-call-delta";
      toolCallId: string;
      argsDelta?: string;
    }
  | {
      type: "tool-call-end";
      toolCallId: string;
      toolName: string;
      args?: unknown;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName?: string;
      result: unknown;
    }
  | { type: "error"; message: string }
  | { type: "finish" };
```

Der genaue interne Typ darf an assistant-ui angepasst werden.

Entscheidend ist die Trennung von:

- normalem Text
- Reasoning
- Tool Calls
- Tool Results
- Fehler
- Finish

---

# 10. assistant-ui Runtime

Bevorzugt eine aktuelle assistant-ui Runtime verwenden.

Da wir einen bereits existierenden Custom-Chat-Endpoint haben, sind die geeigneten Optionen:

1. `LocalRuntime` + eigener `ChatModelAdapter`
2. assistant-ui Data Stream Runtime
3. AI-SDK Runtime, falls sich der vorhandene Endpoint sauber als AI-SDK-kompatibler Stream abbilden lässt

**Priorität: wenig Code und möglichst wenig eigene Zustandsverwaltung.**

Wenn der existierende Endpoint OpenAI-kompatibles Streaming liefert, ist ein eigener dünner Adapter akzeptabel.

assistant-ui soll Conversation State verwalten.

Referenz:

https://www.assistant-ui.com/docs/runtimes/custom/local-runtime

---

# 11. Streaming

Streaming ist Pflicht.

Nicht warten, bis die gesamte Antwort fertig ist.

Erwartetes UX:

```text
User
  ↓

Thinking...
  ↓

Tool: search_vocabulary
running...

Tool: search_vocabulary
completed

Thinking...
  ↓

Assistant Antwort wächst Token für Token
```

`AbortController` unterstützen.

Der Stop-Button muss:

1. den Browserstream abbrechen
2. den Request an `/api/chat` abbrechen
3. soweit möglich den Upstream-Fetch abbrechen

---

# 12. OpenAI-kompatibler Chat-Adapter

Wenn `CHAT_PROTOCOL=openai-compatible` gesetzt ist, soll `/api/chat` sinngemäß folgende Anfrage upstream schicken:

```json
{
  "model": "<CHAT_MODEL>",
  "messages": [],
  "stream": true
}
```

Nur Felder mitsenden, die tatsächlich benötigt werden.

Wenn `CHAT_MODEL` leer ist und der existierende Endpoint kein Model benötigt, das Feld weglassen.

Authorization:

```http
Authorization: Bearer <CHAT_API_KEY>
```

nur senden, wenn ein Key gesetzt ist.

---

# 13. Reasoning / Thinking

Reasoning muss im UI separat vom normalen Antworttext dargestellt werden.

assistant-ui besitzt Reasoning-Message-Parts bzw. Reasoning UI.

Darstellung:

```text
▸ Thinking

  ...
```

Während Reasoning streamt:

- dezente Running-Anzeige
- Panel darf automatisch geöffnet sein

Nach Abschluss:

- standardmäßig einklappbar
- Answer-Text bleibt visuell primär

### Wichtig

Nicht jedes Backend liefert Reasoning gleich.

Adapter muss typische Varianten isolieren können, z. B.:

```text
reasoning
reasoning_content
thinking
analysis
```

Nicht überall im UI provider-spezifische Felder abfragen.

Mapping nur im Chat-Adapter.

Wenn kein Reasoning vorhanden ist:

- kein leeres Thinking-Panel anzeigen

---

# 14. Tool Calls

Tool-Calls müssen sichtbar sein.

assistant-ui Tool UI / Toolkit Rendering verwenden.

Referenz:

https://www.assistant-ui.com/docs/tools/tool-ui

Phase 1 benötigt **keine für jedes Tool individuell gebaute UI**.

Stattdessen einen sauberen generischen Fallback bauen.

Beispiel:

```text
┌──────────────────────────────────────────┐
│ 🔧 get_known_words                ✓ Done │
│                                          │
│ Arguments                                │
│ {                                        │
│   "count": 10,                           │
│   "level": "learning"                    │
│ }                                        │
│                                          │
│ Result                                   │
│ 10 vocabulary items                      │
└──────────────────────────────────────────┘
```

Zustände:

- pending
- running
- completed
- error

Tool-Name sichtbar.

Args optional einklappbar.

Result optional einklappbar.

Große JSON-Ergebnisse nicht ungefiltert auf voller Länge darstellen.

Für große Results:

- Collapsible
- maximale Höhe + Scroll
- ggf. Preview

---

# 15. Tool Calls kommen vom externen Agent

Das Frontend soll MCP **nicht selbst aufrufen**.

Architektur:

```text
assistant-ui
    │
    ▼
existing Chat Endpoint
    │
    ├── MCP Call #1
    ├── MCP Call #2
    └── MCP Call #3
```

Der Chat-Endpoint liefert die Tool-Call-Ereignisse zurück.

`anki-chat` rendert sie.

Dadurch bleibt MCP komplett vom UI entkoppelt.

---

# 16. Chat Request

Frontend sendet mindestens:

```ts
{
  messages: [...]
}
```

Keine Provider-Einstellungen aus dem Browser.

Keine Model-Auswahl.

Optional kann später ergänzt werden:

```ts
{
  conversationId,
  messages,
  metadata
}
```

aber Phase 1 möglichst klein halten.

---

# 17. Chat-History

Phase 1:

- Conversation State nur im Browser
- keine Datenbank notwendig
- kein User Account

Optional LocalStorage:

```text
anki-chat:current-thread
```

Aber nur implementieren, wenn es mit assistant-ui unkompliziert möglich ist.

Keine Datenbank nur für History einführen.

Ein "New Chat"-Button darf die aktuelle Conversation zurücksetzen.

---

# 18. STT

Der STT-Service läuft bereits.

`anki-chat` implementiert:

```text
Browser microphone
      │
      ▼
MediaRecorder
      │
      ▼
POST /api/stt
      │
      ▼
Existing STT endpoint
      │
      ▼
text
      │
      ▼
assistant-ui composer
```

---

# 19. STT UI

Composer ungefähr:

```text
┌─────────────────────────────────────────────┐
│ Nachricht...                                │
│                                             │
│ 🎙                                     ➤    │
└─────────────────────────────────────────────┘
```

Beim Aufnehmen:

```text
🔴 Recording  00:04      ■ Stop
```

Ablauf:

1. User klickt Mikrofon
2. Browser fragt ggf. Microphone Permission
3. `MediaRecorder` startet
4. Audio-Chunks lokal sammeln
5. User stoppt
6. Blob an `/api/stt`
7. Loading State
8. Transkript zurück
9. Text in Composer einsetzen
10. **nicht automatisch absenden**

Das automatische Absenden soll nicht Default sein.

User kann Transkript vor dem Absenden korrigieren.

---

# 20. Audioformat STT

Browser bevorzugt:

```text
audio/webm;codecs=opus
```

Fallback je nach Browser.

Die lokale `/api/stt` Route übernimmt das empfangene File möglichst unverändert und sendet es an den vorhandenen STT-Service.

Für OpenAI-kompatiblen STT-Endpoint:

```text
multipart/form-data

file=<audio blob>
model=<STT_MODEL>
language=<optional STT_LANGUAGE>
```

Rückgabe des lokalen Endpoints vereinheitlichen:

```json
{
  "text": "transcribed text"
}
```

Das Frontend soll nur dieses interne Format kennen.

---

# 21. POST /api/stt

Server Route:

```text
POST /api/stt
Content-Type: multipart/form-data
```

Validieren:

- Datei vorhanden
- maximale Dateigröße
- STT konfiguriert

Fehler als konsistentes JSON:

```json
{
  "error": "STT request failed"
}
```

Mit sinnvoller HTTP Status Code.

Upstream Fehler serverseitig loggen.

Keine API-Keys an Client zurückgeben.

---

# 22. STT Fehlerzustände

UI verständlich behandeln:

- Microphone permission denied
- Browser unterstützt Recording nicht
- Recording fehlgeschlagen
- STT Server nicht erreichbar
- Timeout
- leeres Transkript

Kein `alert()`.

Toast oder Inline-Fehler.

---

# 23. TTS

TTS-Service läuft bereits.

Ablauf:

```text
Assistant Message
      │
      ▼
🔊 Speak
      │
      ▼
POST /api/tts
      │
      ▼
Existing TTS Endpoint
      │
      ▼
audio/*
      │
      ▼
HTMLAudioElement
```

---

# 24. TTS UI

An jeder finalen Assistant-Message:

```text
🔊
```

Beim Abspielen:

```text
⏸
```

oder Stop.

Features:

- Audio starten
- pausieren / stoppen
- erneuter Klick möglich
- beim Start eines anderen TTS-Audios vorheriges Audio stoppen

Keine parallelen TTS-Ausgaben.

---

# 25. assistant-ui Speech Adapter

Wenn sinnvoll, assistant-ui `SpeechSynthesisAdapter` verwenden und einen eigenen Adapter implementieren, der `/api/tts` nutzt.

Referenz:

https://www.assistant-ui.com/docs/guides/speech

Bevorzugt diese Integration gegenüber einer komplett separaten TTS-Logik, sofern sie mit der installierten assistant-ui-Version sauber funktioniert.

---

# 26. POST /api/tts

Interner Request:

```json
{
  "text": "你好，很高兴认识你。"
}
```

Server ergänzt serverseitig:

- model
- voice
- output format
- API-Key

und ruft den externen TTS-Service auf.

Für OpenAI-kompatibles TTS sinngemäß:

```json
{
  "model": "<TTS_MODEL>",
  "voice": "<TTS_VOICE>",
  "input": "你好，很高兴认识你。",
  "response_format": "mp3"
}
```

Nur vorhandene/benötigte Felder senden.

Response:

```http
Content-Type: audio/mpeg
```

bzw. tatsächlichen Audio Content-Type des Upstreams weiterreichen.

---

# 27. TTS Streaming

Phase 1 benötigt **kein Audio-Streaming während die Textantwort noch entsteht**.

Erst wenn eine Assistant-Message fertig ist:

```text
Message finished
   ↓
User clicks Speak
   ↓
TTS request
```

Optional später:

```text
sentence-level streaming TTS
```

Nicht Teil des MVP.

---

# 28. Auto-TTS

Optional:

```dotenv
NEXT_PUBLIC_AUTO_PLAY_TTS=false
```

Wenn `true`, darf nach abgeschlossener Assistant-Antwort automatisch TTS gestartet werden.

Default:

```text
false
```

Browser-Autoplay-Regeln beachten.

MVP darf Auto-Play zunächst deaktiviert lassen, falls Browserrestriktionen die Implementierung unnötig kompliziert machen.

---

# 29. Frontend Layout

Sehr minimal.

Desktop:

```text
┌──────────────────────────────────────────────┐
│ Anki Chat                            New Chat│
├──────────────────────────────────────────────┤
│                                              │
│                 Messages                     │
│                                              │
│  User                                        │
│  ...                                         │
│                                              │
│  Thinking                                    │
│  Tool call                                   │
│  Assistant                                   │
│                                              │
├──────────────────────────────────────────────┤
│  🎙  Message...                        Send  │
└──────────────────────────────────────────────┘
```

Keine linke Sidebar notwendig.

Keine Model-Auswahl.

Keine Settings-Seite für Provider.

---

# 30. Responsive Design

Muss funktionieren auf:

- Desktop
- Tablet
- Smartphone

Mobile:

- Composer bleibt erreichbar
- Safe Area berücksichtigen
- Mikrofon-Button groß genug
- Tool Calls dürfen horizontal nicht den Viewport sprengen
- JSON in Tool Cards umbrechen bzw. scrollen
- Messages nutzen verfügbare Breite sinnvoll

---

# 31. Styling

Schlicht.

Keine unnötigen Animationen.

Dunkles und helles Theme nur übernehmen, wenn es durch den vorhandenen Starter ohnehin vorhanden ist.

Keine Zeit in umfangreiches Branding investieren.

Priorität:

1. Lesbarkeit
2. Streaming
3. Tool Calls
4. Reasoning
5. Audio UX

---

# 32. Markdown

Assistant-Antworten als Markdown rendern.

Unterstützen:

- Paragraphs
- Listen
- Tabellen
- Inline Code
- Code Blocks
- Links
- Blockquotes

Code Blocks sollten Copy-Button haben, wenn durch assistant-ui Starter bereits vorhanden.

---

# 33. Chinesischer Text

Da die Anwendung primär für Sprachlernen gedacht ist:

- Unicode vollständig unterstützen
- chinesische Zeichen dürfen nicht durch ungeeignete Font-Wahl beschädigt werden
- `lang` nicht global fälschlich ausschließlich auf Englisch setzen
- Mixed Chinese/Latin text muss sauber dargestellt werden

Kein spezieller Pinyin-Renderer im MVP erforderlich.

---

# 34. Loading / Status UX

Folgende Zustände klar unterscheiden:

```text
Idle
Recording
Transcribing
Submitting
Thinking/Streaming
Tool Running
Speaking
Error
```

Buttons während inkompatibler Zustände sinnvoll deaktivieren.

Beispiele:

Während STT Upload:

```text
Transcribing…
```

Während Chat Request:

```text
Stop
```

Während TTS:

```text
Stop speaking
```

---

# 35. Fehlerbehandlung

Einheitliches Fehlerformat der lokalen API-Routen:

```ts
type ApiError = {
  error: string;
  detail?: string;
};
```

`detail` im Production UI nicht ungefiltert anzeigen.

Server Logs dürfen technische Details enthalten.

User sieht z. B.:

```text
Chat service is currently unavailable.
```

oder:

```text
Speech recognition failed. Please try again.
```

---

# 36. Timeouts

Für externe Services sinnvolle Timeouts vorsehen.

Beispiel:

```text
STT: 60s
TTS: 60s
Chat: kein kurzer Request-Timeout, da Streaming
```

Chat soll über AbortController abbrechbar bleiben.

Timeout-Werte optional per Env konfigurierbar:

```dotenv
STT_TIMEOUT_MS=60000
TTS_TIMEOUT_MS=60000
```

---

# 37. Security

Pflicht:

- Secrets nur serverseitig
- Upstream URLs nur serverseitig
- keine Keys in Browser-Bundle
- keine Keys in Logs
- keine `.env` committen
- `.env.example` ohne Secrets
- Request Body Größen limitieren, insbesondere STT
- TTS Textlänge limitieren
- Fehler vom Upstream nicht vollständig an den Browser leaken

Da das Projekt zunächst lokal/self-hosted ohne Userverwaltung läuft, ist keine eigene Login-Schicht erforderlich.

---

# 38. Empfohlene Projektstruktur

An vorhandenes Projekt anpassen.

Ziel ungefähr:

```text
anki-chat/
├── app/
│   ├── api/
│   │   ├── chat/
│   │   │   └── route.ts
│   │   ├── stt/
│   │   │   └── route.ts
│   │   └── tts/
│   │       └── route.ts
│   │
│   ├── layout.tsx
│   └── page.tsx
│
├── components/
│   ├── assistant/
│   │   ├── assistant.tsx
│   │   ├── thread.tsx
│   │   ├── composer.tsx
│   │   ├── reasoning.tsx
│   │   └── tool-fallback.tsx
│   │
│   └── audio/
│       ├── microphone-button.tsx
│       └── ...
│
├── lib/
│   ├── config.ts
│   │
│   ├── chat/
│   │   ├── adapter.ts
│   │   ├── types.ts
│   │   └── openai-compatible.ts
│   │
│   ├── stt/
│   │   └── client.ts
│   │
│   └── tts/
│       ├── client.ts
│       └── speech-adapter.ts
│
├── .env.example
├── Dockerfile
├── docker-compose.yml
└── README.md
```

Wenn der assistant-ui Starter bereits eine andere sinnvolle Struktur erzeugt hat:

**bestehende Struktur respektieren.**

---

# 39. Docker

Produktionsfähigen Multi-Stage Docker Build anlegen.

Beispielbasis:

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 3000

CMD ["node", "server.js"]
```

An Package Manager anpassen.

---

# 40. Next.js Standalone Output

Falls noch nicht vorhanden:

```ts
const nextConfig = {
  output: "standalone",
};

export default nextConfig;
```

Nur konfigurieren, wenn mit der vorhandenen Next.js-Version passend.

---

# 41. docker-compose.yml

Nur `anki-chat` starten.

Die externen Chat/STT/TTS Services werden **nicht** in diesem Compose neu implementiert.

Beispiel:

```yaml
services:
  anki-chat:
    build:
      context: .
    container_name: anki-chat
    restart: unless-stopped

    ports:
      - "3000:3000"

    env_file:
      - .env

    extra_hosts:
      - "host.docker.internal:host-gateway"
```

`extra_hosts` ist hilfreich, wenn Services direkt auf dem Docker Host laufen.

Wenn alle Endpoints bereits über DNS/LAN erreichbar sind, kann es entfallen.

---

# 42. Health Endpoint

Optional aber empfohlen:

```text
GET /api/health
```

Antwort:

```json
{
  "status": "ok"
}
```

Keine externen Services zwingend abfragen.

Der Healthcheck soll primär zeigen, dass `anki-chat` läuft.

Optional detaillierter:

```json
{
  "status": "ok",
  "features": {
    "chat": true,
    "stt": true,
    "tts": true
  }
}
```

Keine Secrets oder URLs ausgeben.

---

# 43. Docker Healthcheck

Optional:

```yaml
healthcheck:
  test:
    [
      "CMD",
      "wget",
      "--spider",
      "-q",
      "http://127.0.0.1:3000/api/health"
    ]
  interval: 30s
  timeout: 5s
  retries: 3
```

Nur verwenden, wenn das Runtime Image das benötigte Tool enthält.

Alternativ passenden Node-basierten Check.

---

# 44. README

README soll kurz erklären:

## Start Development

```bash
cp .env.example .env
npm install
npm run dev
```

bzw. passenden Package Manager.

## Production

```bash
docker compose up -d --build
```

## Config

Tabelle:

| Variable | Required | Description |
|---|---|---|
| `CHAT_API_URL` | yes | Existing chat endpoint |
| `CHAT_API_KEY` | no | API key |
| `CHAT_MODEL` | no | model forwarded to endpoint |
| `STT_API_URL` | for STT | Existing speech-to-text endpoint |
| `STT_API_KEY` | no | STT API key |
| `STT_MODEL` | no | STT model |
| `TTS_API_URL` | for TTS | Existing text-to-speech endpoint |
| `TTS_API_KEY` | no | TTS API key |
| `TTS_MODEL` | no | TTS model |
| `TTS_VOICE` | no | TTS voice |

---

# 45. Feature Flags

Wenn Endpoint nicht konfiguriert:

### STT

Wenn:

```text
STT_API_URL missing
```

dann:

- App startet trotzdem
- Mikrofon-Button ausblenden/deaktivieren
- kein Build-Fehler

### TTS

Wenn:

```text
TTS_API_URL missing
```

dann:

- App startet trotzdem
- TTS-Button ausblenden

### Chat

Wenn:

```text
CHAT_API_URL missing
```

dann:

- Startup oder Request mit klarer Fehlermeldung
- Chat ist Kernfunktion

---

# 46. Tests

Mindestens kleine Tests für kritische Adapterlogik.

Priorität:

## Chat parsing

Testen:

```text
text delta
reasoning delta
tool call start
tool call arguments split over multiple chunks
tool result
finish
upstream error
```

Wichtig:

Tool Arguments können fragmentiert über mehrere Streaming-Chunks kommen.

Sie dürfen nicht pro Chunk blind mit `JSON.parse()` geparst werden.

Stattdessen:

```text
toolCallId -> argument buffer
```

führen und erst parsen, wenn vollständig.

---

# 47. STT Tests

Prüfen:

- Multipart wird korrekt weitergeleitet
- API-Key Header korrekt
- Text wird normalisiert
- Upstream 500 wird korrekt gemappt
- keine Datei -> 400

---

# 48. TTS Tests

Prüfen:

- Text wird korrekt weitergeleitet
- Voice/Model aus Config
- Content-Type korrekt durchgereicht
- Upstream Fehler korrekt
- leerer Text -> 400

---

# 49. Tool-Call Streaming — wichtige Implementierungsregel

Bei Streaming dürfen bereits empfangene Tool Calls nicht verschwinden.

Wenn der Chatstream z. B.:

```text
Chunk 1: tool-call
Chunk 2: tool args delta
Chunk 3: text delta
```

liefert, muss der Tool Call weiterhin Teil des aktuellen Assistant-Zustands sein.

Tool State daher nach `toolCallId` akkumulieren.

Sinngemäß:

```ts
const toolCalls = new Map<string, ToolCallState>();
```

Nicht nur den jeweils letzten Chunk rendern.

---

# 50. Reasoning Streaming — wichtige Implementierungsregel

Analog Reasoning akkumulieren.

Nicht:

```text
chunk.reasoning ersetzen
```

sondern:

```text
reasoning += delta
```

Nur nicht-leere Reasoning Parts an assistant-ui weitergeben.

---

# 51. Conversation UX

MVP Buttons:

```text
New Chat
Stop generation
Copy assistant answer
Retry / regenerate
Microphone
Speak
```

Edit previous message ist optional.

Branching ist optional.

Attachments sind **nicht Teil des MVP**.

---

# 52. Kein Model Selector

Explizit nicht implementieren:

```text
GPT
Claude
Gemini
Qwen
...
```

Das Backend entscheidet das Modell bzw. `CHAT_MODEL` kommt ausschließlich aus `.env`.

Frontend zeigt keinen Provider-Namen.

---

# 53. Kein User-System

Nicht implementieren:

- Login
- Register
- Session Auth
- User DB
- OAuth
- Roles
- Admin

Das Projekt ist eine private/self-hosted Single-User UI.

---

# 54. Kein MCP-Management im UI

Nicht implementieren:

```text
Add MCP server
Remove MCP server
MCP settings
MCP permissions
```

MCP gehört zum bestehenden Chat-/Agent-Backend.

Das Frontend zeigt nur Calls an.

---

# 55. Nicht Teil des MVP

Folgende Dinge bewusst **nicht** implementieren:

- eigener LLM Server
- eigener MCP Server
- eigener MCP Client im Browser
- eigener STT Server
- eigener TTS Server
- RAG
- Vector DB
- Userverwaltung
- Modelverwaltung
- Prompt Library
- Marketplace
- Plugins UI
- Attachments
- Web Search UI
- Datenbank
- Analytics
- komplexe Conversation History
- Voice-to-Voice Realtime Mode

---

# 56. Akzeptanzkriterien

Das Projekt ist fertig, wenn:

### Chat

- [ ] Seite öffnet sich als einzelnes Chatfenster
- [ ] User kann Nachricht absenden
- [ ] Request geht über `/api/chat`
- [ ] `/api/chat` verwendet `CHAT_API_URL`
- [ ] Antwort streamt sichtbar
- [ ] Stop bricht Request ab
- [ ] normale Assistant-Antwort wird als Markdown dargestellt

### Reasoning

- [ ] Reasoning wird getrennt vom Antworttext angezeigt
- [ ] Reasoning ist einklappbar
- [ ] leeres Reasoning erzeugt keinen leeren Block
- [ ] Reasoning streamt live

### Tool Calls

- [ ] Tool Calls sind sichtbar
- [ ] Tool Name sichtbar
- [ ] Arguments können angezeigt werden
- [ ] Tool Result kann angezeigt werden
- [ ] Running/Completed/Error Zustand erkennbar
- [ ] mehrere Tool Calls innerhalb einer Antwort funktionieren
- [ ] mehrere Tool Calls hintereinander funktionieren

### STT

- [ ] Mikrofonbutton existiert
- [ ] Aufnahme startet
- [ ] Aufnahme stoppt
- [ ] Audio geht über `/api/stt`
- [ ] `/api/stt` ruft bestehenden STT-Service auf
- [ ] Transkript landet im Composer
- [ ] Transkript wird nicht ungefragt abgesendet

### TTS

- [ ] Assistant Message besitzt Speak-Button
- [ ] TTS Request geht über `/api/tts`
- [ ] `/api/tts` ruft bestehenden TTS-Service auf
- [ ] Audio wird abgespielt
- [ ] Audio kann gestoppt werden
- [ ] maximal eine TTS-Wiedergabe gleichzeitig

### Deployment

- [ ] `.env.example` vorhanden
- [ ] Dockerfile vorhanden
- [ ] `docker compose up -d --build` funktioniert
- [ ] App erreichbar auf Port 3000
- [ ] keine Secrets im Browserbundle

---

# 57. Definition of Done

Vor Abschluss ausführen:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

bzw. äquivalente vorhandene Scripts.

Zusätzlich Docker testen:

```bash
docker build -t anki-chat .
docker run --rm \
  --env-file .env \
  -p 3000:3000 \
  anki-chat
```

Danach manuell prüfen:

1. Chat senden
2. Streaming beobachten
3. Reasoning beobachten
4. mindestens einen Tool Call beobachten
5. STT aufnehmen
6. Transkript editieren
7. senden
8. TTS abspielen
9. TTS stoppen
10. New Chat

---

# 58. Implementierungsreihenfolge

Der Agent soll in dieser Reihenfolge vorgehen:

## Phase 1 — Repository verstehen

- vorhandene Architektur analysieren
- assistant-ui Version bestimmen
- Package Manager bestimmen
- vorhandene Komponenten wiederverwenden

## Phase 2 — Basischat

- assistant-ui Runtime
- minimalistisches Thread UI
- `/api/chat`
- Streaming Text
- Stop

## Phase 3 — Agent Events

- Reasoning Mapping
- Tool-Call Mapping
- generischer Tool Renderer
- Tool Result Rendering

## Phase 4 — STT

- MediaRecorder
- `/api/stt`
- Composer Integration
- Error States

## Phase 5 — TTS

- `/api/tts`
- assistant-ui Speech Adapter oder äquivalente Integration
- Playback Lifecycle

## Phase 6 — Deployment

- `.env.example`
- Dockerfile
- docker-compose
- README
- Health endpoint

## Phase 7 — Qualität

- Tests
- lint
- typecheck
- production build
- Docker smoke test

---

# 59. Architekturregel für den Agenten

**Keep the frontend dumb.**

Business Logic gehört nicht in React-Komponenten.

React:

```text
display
interaction
audio capture/playback
```

Server Adapter:

```text
authentication
provider-specific payload
provider-specific streaming format
normalization
```

Externer Chat Service:

```text
LLM
Agent
MCP
tool execution
agent orchestration
```

---

# 60. Wichtigste Designentscheidung

Wenn während der Implementierung Unklarheiten beim Chat-Streaming auftreten:

**nicht assistant-ui entfernen und keine eigene Chat-UI von Null bauen.**

Stattdessen die Adapter-Schicht verbessern.

Gewünschte Trennung:

```text
assistant-ui
     │
     ▼
Normalized Chat Events
     │
     ▼
Provider Adapter
     │
     ▼
Existing Chat Endpoint
```

So bleibt das Projekt auch dann stabil, wenn der Chat-Endpoint später gewechselt wird.

---

# 61. Hinweise zum realen Endpoint-Contract

Vor Implementierung der Provider-Adapter die tatsächlich vorhandenen Endpoints testen bzw. vorhandene API-Dokumentation prüfen.

Für jeden Endpoint dokumentieren:

## Chat

```text
URL:
Method:
Auth:
Request JSON:
Streaming Content-Type:
Text delta location:
Reasoning delta location:
Tool call representation:
Tool result representation:
Finish marker:
Error representation:
```

## STT

```text
URL:
Method:
Auth:
Multipart field name:
Accepted audio formats:
Model field:
Language field:
Response text path:
```

## TTS

```text
URL:
Method:
Auth:
Request JSON:
Model:
Voice:
Output format:
Response Content-Type:
```

Anschließend nur die jeweilige Adapterdatei an den tatsächlichen Contract anpassen.

**Keine hypothetischen Backend-Felder über das gesamte Projekt verteilen.**

---

# 62. Endzustand

Nach erfolgreicher Implementierung soll die Benutzung nur noch so aussehen:

```bash
git clone ...
cd anki-chat

cp .env.example .env

# URLs/Keys der bereits laufenden Dienste eintragen
nano .env

docker compose up -d --build
```

Danach:

```text
http://localhost:3000
```

und der Nutzer sieht ausschließlich eine schlanke Chatoberfläche mit:

```text
Chat
Thinking
Tool Calls
STT
TTS
```

Keine LibreChat-/Open-WebUI-artige Verwaltungsplattform.
