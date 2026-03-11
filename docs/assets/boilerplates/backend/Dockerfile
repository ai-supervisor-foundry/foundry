ARG BASE_IMG="20.11-slim"

FROM node:$BASE_IMG AS builder

RUN npm i -g ts-node pnpm
USER node

WORKDIR /usr/src/app
COPY --chown=node:node package*.json ./

RUN pnpm i
COPY --chown=node:node . .

ARG APP_BASE_URL="http://host.docker.internal:3000"
ARG APP_PORT="3000"
ARG CORS_ORIGINS="http://host.docker.internal:3000,http://host.docker.internal:3001"
ARG DB_URI
ARG JWT_SECRET
ARG SENDGRID_API_KEY
ARG SENDGRID_FROM_EMAIL
ARG AWS_ACCESS_KEY_ID
ARG AWS_SECRET_ACCESS_KEY
ARG AWS_BUCKET_REGION
ARG REDIS_URL="redis://host.docker.internal:6379"
ARG MAIL_CONNECTION_STRING

RUN cp .env.example .env \
    && sed -i'' "s~{APP_BASE_URL}~${APP_BASE_URL}~g" .env \
    && sed -i'' "s~{APP_PORT}~${APP_PORT}~g" .env \
    && sed -i'' "s~{CORS_ORIGINS}~${CORS_ORIGINS}~g" .env \
    && sed -i'' "s~{DB_URI}~${DB_URI}~g" .env \
    && sed -i'' "s~{JWT_SECRET}~${JWT_SECRET}~g" .env \
    && sed -i'' "s~{SENDGRID_API_KEY}~${SENDGRID_API_KEY}~g" .env \
    && sed -i'' "s~{SENDGRID_FROM_EMAIL}~${SENDGRID_FROM_EMAIL}~g" .env \
    && sed -i'' "s~{AWS_ACCESS_KEY_ID}~${AWS_ACCESS_KEY_ID}~g" .env \
    && sed -i'' "s~{AWS_SECRET_ACCESS_KEY}~${AWS_SECRET_ACCESS_KEY}~g" .env \
    && sed -i'' "s~{AWS_BUCKET_REGION}~${AWS_BUCKET_REGION}~g" .env \
    && sed -i'' "s~{REDIS_URL}~${REDIS_URL}~g" .env \
    && sed -i'' "s~{MAIL_CONNECTION_STRING}~${MAIL_CONNECTION_STRING}~g" .env

# RUN npm run build

FROM node:$BASE_IMG AS runner
COPY --from=builder /usr/src/app /usr/src/app

WORKDIR /usr/src/app

ENV RUN_MIGRATION false

CMD if $RUN_MIGRATION; then \
    npm run migration:run; \
    fi && \
    npm start

EXPOSE 3000

# CMD ["/bin/bash","-c","sleep infinity"]