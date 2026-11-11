FROM node:20-alpine

WORKDIR /app

COPY services/chat/package*.json ./services/chat/
RUN cd services/chat && npm install --omit=dev

COPY services/chat ./services/chat

COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /app/services/chat

EXPOSE 8002

CMD ["npm", "start"]