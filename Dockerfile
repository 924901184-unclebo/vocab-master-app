FROM node:20-slim

WORKDIR /app

# 复制依赖清单
COPY package.json package-lock.json ./

# 安装生产依赖
RUN npm ci --production --ignore-scripts

# 复制源码
COPY server/ ./server/

# 微信云托管默认使用 80 端口
EXPOSE 80

CMD ["node", "server/app.js"]