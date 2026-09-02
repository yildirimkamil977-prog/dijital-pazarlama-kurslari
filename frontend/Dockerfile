# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

ENV NODE_OPTIONS=--max-old-space-size=4096

COPY package.json ./
COPY yarn.lock* ./
RUN yarn install --network-timeout 600000

COPY . .

# Injected at build time via docker-compose build args
ARG REACT_APP_BACKEND_URL
ARG REACT_APP_GOOGLE_CLIENT_ID
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID

RUN yarn build

# ---- Serve stage ----
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
