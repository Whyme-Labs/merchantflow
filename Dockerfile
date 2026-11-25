FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json server.mjs qie.mjs ./
COPY public ./public
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=3s CMD node -e 'fetch("http://127.0.0.1:" + (process.env.PORT || 8080) + "/healthz").then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))'
CMD ["node", "server.mjs"]
