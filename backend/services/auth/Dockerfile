FROM node:20-alpine

WORKDIR /app

COPY services/auth/package*.json ./services/auth/
RUN cd services/auth && npm install --omit=dev

COPY services/auth ./services/auth

COPY shared ./shared
RUN cd shared && npm install --omit=dev

WORKDIR /app/services/auth

EXPOSE 8001

CMD ["npm", "start"]