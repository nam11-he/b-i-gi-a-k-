# Shortcuts for the midterm build on macOS and Linux. On Windows run the same docker compose and python commands
# (see README). `make` alone lists the commands.

PYTHON ?= $(if $(filter Windows_NT,$(OS)),py,python3)
# Same image as the gateway and learning-service jobs in .gitlab-ci.yml, so the tests need no uv on this machine.
# The sources are copied inside the container: nothing is written to the service folders.
UV_IMAGE = ghcr.io/astral-sh/uv:0.12.21-python3.12-trixie-slim

.PHONY: help env deploy up seed test system-test logs stop down

help: ## Liệt kê các lệnh
	@awk 'BEGIN {FS = ":.*## "} /^[a-z-]+:.*## / {printf "  make %-12s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

env: ## Tạo file .env từ .env.example nếu chưa có
	@test -f .env || { cp .env.example .env && echo "Đã tạo .env từ .env.example"; }

deploy: up seed ## Dựng toàn bộ: hệ thống trong Docker rồi dữ liệu demo; mở http://nambede.dev.localhost

up: env ## Build và chạy PostgreSQL, Auth Service, Learning Service, gateway, web; chờ tất cả healthy
	docker compose up -d --build --wait

seed: ## Tạo dữ liệu demo qua gateway (chạy lại không tạo trùng)
	$(PYTHON) scripts/demo_data.py

test: ## pytest của gateway và Learning Service, chạy trong container (không cần cài uv)
	@for service in gateway learning-service; do \
		echo "== $$service"; \
		docker run --rm -v "$(CURDIR)/services/$$service:/src:ro" -v nambede-midterm-uv-cache:/root/.cache/uv \
			-e UV_PROJECT_ENVIRONMENT=/tmp/venv -e UV_LINK_MODE=copy -e PYTHONDONTWRITEBYTECODE=1 $(UV_IMAGE) \
			sh -c 'mkdir /app && tar -C /src --exclude=./.venv -cf - . | tar -C /app -xf - && cd /app && uv run --locked pytest -q -p no:cacheprovider' \
			|| exit 1; \
	done

system-test: ## Kiểm thử cả hệ thống đang chạy, qua gateway như một client
	$(PYTHON) scripts/system_test.py

logs: ## Xem log của cả hệ thống
	docker compose logs -f --tail=100

stop: ## Dừng các container, giữ dữ liệu
	docker compose stop

down: ## Xóa các container và toàn bộ dữ liệu (database được tạo lại ở lần up sau)
	docker compose down -v
