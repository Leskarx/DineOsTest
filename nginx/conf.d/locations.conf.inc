    # ── Auth endpoints — rate-limited tightly ─────────────────────────────
    location ~ ^/api/v1/auth/(login|register|forgot-password|otp) {
      limit_req zone=auth burst=5 nodelay;
      limit_req_status 429;

      proxy_pass         http://api;
      proxy_http_version 1.1;
      proxy_set_header   Host              $host;
      proxy_set_header   X-Real-IP         $remote_addr;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Proto $scheme;
      proxy_read_timeout 30s;
    }

    # ── API — general ─────────────────────────────────────────────────────
    location /api {
      limit_req zone=api burst=30 nodelay;

      proxy_pass         http://api;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade           $http_upgrade;
      proxy_set_header   Connection        'upgrade';
      proxy_set_header   Host              $host;
      proxy_set_header   X-Real-IP         $remote_addr;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Proto $scheme;
      proxy_cache_bypass $http_upgrade;
      proxy_read_timeout 120s;
      proxy_send_timeout 120s;
    }

    # ── Health probe — no rate limit, no auth ─────────────────────────────
    location /health {
      proxy_pass         http://api;
      proxy_http_version 1.1;
      proxy_set_header   Host $host;
      access_log         off;
    }

    # ── Static uploads served from API ────────────────────────────────────
    location /static/ {
      proxy_pass         http://api;
      proxy_http_version 1.1;
      proxy_set_header   Host $host;
      # Cache static files at nginx level
      proxy_cache_valid  200 7d;
      add_header         Cache-Control "public, max-age=604800, immutable";
      access_log         off;
    }

    # ── Socket.IO — long-poll + WebSocket ─────────────────────────────────
    location /socket.io {
      proxy_pass         http://api;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade    $http_upgrade;
      proxy_set_header   Connection "upgrade";
      proxy_set_header   Host       $host;
      proxy_set_header   X-Real-IP  $remote_addr;
      # Long timeouts for persistent WS connections
      proxy_read_timeout  3600s;
      proxy_send_timeout  3600s;
    }

    # ── Next.js web app ───────────────────────────────────────────────────
    location / {
      proxy_pass         http://web;
      proxy_http_version 1.1;
      proxy_set_header   Upgrade           $http_upgrade;
      proxy_set_header   Connection        'upgrade';
      proxy_set_header   Host              $host;
      proxy_set_header   X-Real-IP         $remote_addr;
      proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
      proxy_set_header   X-Forwarded-Proto $scheme;
      proxy_cache_bypass $http_upgrade;
    }
