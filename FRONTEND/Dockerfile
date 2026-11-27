# Fully qualified image names: Podman rejects short names unless the host configures a search registry.
FROM docker.io/library/node:22-alpine AS build

# Same-origin path proxied to the backend by nginx.conf. Override with
# --build-arg VITE_API_URL=https://... only to point at a backend hosted elsewhere.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM docker.io/library/nginx:mainline-alpine

RUN apk upgrade --no-cache

COPY --from=build /app/dist /usr/share/nginx/html

# nginx.conf is a template: at startup the nginx image writes it to conf.d/default.conf, filling in
# ${NGINX_LOCAL_RESOLVERS} from the container's /etc/resolv.conf (and nothing else, per the filter).
ENV NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 NGINX_ENVSUBST_FILTER=NGINX_LOCAL_RESOLVERS
COPY nginx.conf /etc/nginx/templates/default.conf.template

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
