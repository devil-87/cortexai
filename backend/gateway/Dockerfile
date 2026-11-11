FROM node:20-alpine

WORKDIR /app

COPY gateway/package*.json ./gateway/
RUN cd gateway && npm install --omit=dev

COPY gateway/ ./gateway/

COPY shared/ ./shared/
RUN cd shared && npm install --omit=dev

WORKDIR /app/gateway

EXPOSE 8000

CMD ["npm", "start"]