.DEFAULT_GOAL := help

COMPOSE ?= docker compose
APP_URL ?= http://localhost:3000

.PHONY: help setup dict-download dev lint typecheck test build up down restart logs ps health clean clean-data

help: ## Show available commands
	@printf '%s\n' \
		'Usage: make <target>' \
		'' \
		'  setup          Create .env, install dependencies, and download dictionaries' \
		'  dict-download  Download CC-CEDICT and HanDeDict' \
		'  dev            Start the local development server' \
		'  lint           Run lint and formatting checks' \
		'  typecheck      Run the TypeScript check' \
		'  test           Run the test suite' \
		'  build          Download dictionaries and create a production build' \
		'  up             Build and start the Docker deployment' \
		'  down           Stop and remove the Docker deployment' \
		'  restart        Rebuild and restart the Docker deployment' \
		'  logs           Follow Docker service logs' \
		'  ps             Show Docker service status' \
		'  health         Check the application health endpoint' \
		'  clean          Remove local Next.js build output' \
		'  clean-data     Remove downloaded dictionary files'

setup:
	@test -f .env || cp .env.example .env
	npm ci
	$(MAKE) dict-download

dict-download:
	npm run dict:download

dev:
	npm run dev

lint:
	npm run lint

typecheck:
	npm run typecheck

test:
	npm run test

build: dict-download
	npm run build

up:
	@test -f .env || (printf '%s\n' 'Missing .env. Run "make setup" or copy .env.example to .env.' && exit 1)
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart:
	@test -f .env || (printf '%s\n' 'Missing .env. Run "make setup" or copy .env.example to .env.' && exit 1)
	$(COMPOSE) down
	$(COMPOSE) up -d --build

logs:
	$(COMPOSE) logs -f

ps:
	$(COMPOSE) ps

health:
	curl --fail --silent --show-error "$(APP_URL)/api/health"
	@printf '\n'

clean:
	rm -rf .next

clean-data:
	rm -f data/*.u8 data/*.tmp
