# Usar Node.js LTS
FROM node:18-alpine

# Establecer directorio de trabajo
WORKDIR /app

# Copiar package.json del backend
COPY backend/package*.json ./backend/

# Instalar dependencias
RUN cd backend && npm install --production

# Copiar todo el código
COPY backend ./backend
COPY frontend ./frontend

# Crear directorio de datos si no existe
RUN mkdir -p backend/data

# Exponer el puerto
EXPOSE 3000

# Variable de entorno
ENV NODE_ENV=production

# Comando de inicio
CMD ["node", "backend/server.js"]
