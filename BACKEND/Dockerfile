# Fully qualified image name: Podman rejects short names unless the host configures a search registry.
FROM docker.io/library/node:22-alpine

RUN apk add --no-cache curl

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 5000

CMD ["npm", "start"]
