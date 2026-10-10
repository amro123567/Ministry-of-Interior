# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /build

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ---- runtime stage ----
FROM nginx:1.27-alpine

# Self-signed TLS cert for local/demo HTTPS. Generated fresh at build time
# so it isn't checked into the repo. Not for production use -- see the
# HTTPS note in nginx.conf.
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
         -keyout /etc/nginx/certs/server.key \
         -out /etc/nginx/certs/server.crt \
         -subj "/C=LB/ST=Beirut/L=Beirut/O=Ministry of Interior/OU=CTS/CN=localhost"

# If a locally trusted cert (e.g. from mkcert) is mounted at /etc/nginx/certs-local,
# use it instead of the self-signed fallback above. With nothing mounted the
# fallback is used, so a fresh clone starts without any manual setup.
RUN printf '%s\n' '#!/bin/sh' \
      'if [ -s /etc/nginx/certs-local/server.crt ] && [ -s /etc/nginx/certs-local/server.key ]; then' \
      '  cp /etc/nginx/certs-local/server.crt /etc/nginx/certs/server.crt' \
      '  cp /etc/nginx/certs-local/server.key /etc/nginx/certs/server.key' \
      'fi' > /docker-entrypoint.d/40-local-certs.sh \
    && chmod +x /docker-entrypoint.d/40-local-certs.sh

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443
