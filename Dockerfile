# Usa una imagen base de Node.js
FROM node:20

# Instala dependencias del sistema para Chromium como root
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-kacst \
    && rm -rf /var/lib/apt/lists/*

# Crea un usuario no root y configura el directorio de trabajo
RUN useradd -m myuser && mkdir /app && chown myuser:myuser /app

# Cambia al usuario no root
USER myuser

# Define el directorio de trabajo
WORKDIR /app

# Copia los archivos del proyecto como el usuario myuser
COPY --chown=myuser:myuser package.json package-lock.json ./
RUN npm install

# Copia el resto del código como el usuario myuser
COPY --chown=myuser:myuser . .

# Configura Puppeteer para usar el Chromium instalado
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_ARGS="--no-sandbox --disable-setuid-sandbox --disable-gpu --disable-dev-shm-usage"

# Expone el puerto
EXPOSE 3000

# Inicia el servidor
CMD ["npm", "start"]