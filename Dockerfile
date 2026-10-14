FROM node:24-alpine

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=10000

WORKDIR /app

COPY apps/desktop/package.json apps/desktop/package-lock.json ./apps/desktop/
RUN cd apps/desktop && npm ci --omit=dev --ignore-scripts --no-audit --no-fund

COPY apps/desktop ./apps/desktop
COPY ["Great White Shark/work/final/spritesheet-extended.png", "Great White Shark/work/final/spritesheet-extended.png"]

RUN cd apps/desktop && npm run build && chown -R node:node /app

USER node
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + (process.env.PORT || 10000) + '/api/health').then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

CMD ["npm", "--prefix", "apps/desktop", "start"]
