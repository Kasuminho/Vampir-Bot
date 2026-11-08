FROM node:20-alpine

# Diretório de trabalho da aplicação
WORKDIR /app

# Instala dependências de sistema necessárias (tzdata para fuso horário correto do Brasil)
RUN apk add --no-cache tzdata
ENV TZ=America/Sao_Paulo

# Copia manifestos de pacotes
COPY package*.json ./

# Instala dependências de produção
RUN npm ci --omit=dev

# Copia todo o código-fonte
COPY . .

# Cria o diretório de dados persistentes caso não exista
RUN mkdir -p /app/data

# Define ambiente de produção
ENV NODE_ENV=production

# Executa o bot
CMD ["node", "src/index.js"]
