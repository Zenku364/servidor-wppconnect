# Usa una imagen base de Node.js
FROM node:18

# Crea un usuario no root
RUN useradd -m myuser && mkdir /app && chown myuser:myuser /app

# Cambia al usuario no root
USER myuser

# Instala dependencias del sistema para Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    && rm -rf /var/lib/apt/lists/*

# Define el directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto
COPY package.json package-lock.json ./
RUN npm install

# Copia el resto del código
COPY . .

# Configura Puppeteer para usar el Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-gpu"

# Expone el puerto
EXPOSE 3000

# Inicia el servidor
CMD ["npm", "start"]