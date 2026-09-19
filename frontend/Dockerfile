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

COPY --from=build /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 443
