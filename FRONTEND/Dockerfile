FROM node:22-alpine AS build

# Same-origin path proxied to the backend by nginx.conf. Override with
# --build-arg VITE_API_URL=https://... only to point at a backend hosted elsewhere.
ARG VITE_API_URL=/api
ENV VITE_API_URL=${VITE_API_URL}

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

FROM nginx:mainline-alpine

RUN apk upgrade --no-cache

COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
