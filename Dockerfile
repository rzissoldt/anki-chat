# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_APP_NAME="Anki Chat"
ARG NEXT_PUBLIC_ENABLE_REASONING=true
ARG NEXT_PUBLIC_ENABLE_TOOL_CALLS=true
ARG NEXT_PUBLIC_ENABLE_STT=true
ARG NEXT_PUBLIC_ENABLE_TTS=true
ARG NEXT_PUBLIC_AUTO_PLAY_TTS=false
ARG NEXT_PUBLIC_CHAT_MAX_CONTEXT=32768

ENV NEXT_PUBLIC_APP_NAME=$NEXT_PUBLIC_APP_NAME
ENV NEXT_PUBLIC_ENABLE_REASONING=$NEXT_PUBLIC_ENABLE_REASONING
ENV NEXT_PUBLIC_ENABLE_TOOL_CALLS=$NEXT_PUBLIC_ENABLE_TOOL_CALLS
ENV NEXT_PUBLIC_ENABLE_STT=$NEXT_PUBLIC_ENABLE_STT
ENV NEXT_PUBLIC_ENABLE_TTS=$NEXT_PUBLIC_ENABLE_TTS
ENV NEXT_PUBLIC_AUTO_PLAY_TTS=$NEXT_PUBLIC_AUTO_PLAY_TTS
ENV NEXT_PUBLIC_CHAT_MAX_CONTEXT=$NEXT_PUBLIC_CHAT_MAX_CONTEXT
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run dict:download && npm run build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
