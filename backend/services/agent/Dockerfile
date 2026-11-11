FROM node:22-alpine

WORKDIR /app

COPY services/agent/package*.json ./services/agent/
RUN cd services/agent && npm install --omit=dev

COPY services/agent ./services/agent

COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /app/services/agent

EXPOSE 8003

CMD ["npm", "start"]