FROM node:20-alpine

WORKDIR /app

COPY services/billing/package*.json ./services/billing/
RUN cd services/billing && npm install --omit=dev

COPY services/billing ./services/billing

COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /app/services/billing

EXPOSE 8004

CMD ["npm", "start"]