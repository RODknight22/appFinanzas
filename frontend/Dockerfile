# Imagen de desarrollo: ejecuta el servidor de Vite con recarga en caliente.
FROM node:22-alpine

WORKDIR /app

# Igual que en el backend: primero las dependencias para aprovechar la caché.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev"]
