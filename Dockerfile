FROM node:20

# Añade el repositorio de Google Chrome para Chromium usando gpg (moderno y compatible)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN wget -q -O - https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg && \
    echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" > /etc/apt/sources.list.d/google-chrome.list

# Instala dependencias del sistema para Chromium como root
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
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