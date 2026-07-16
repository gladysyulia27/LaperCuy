FROM node:22-bookworm-slim

WORKDIR /app

COPY backend/package*.json ./backend/
RUN cd backend && npm ci --omit=dev

COPY backend ./backend
COPY frontend ./frontend
COPY database ./database

WORKDIR /app/backend
EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && npm run seed && node server.js"]
