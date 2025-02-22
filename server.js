const express = require("express");
const { create } = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = 3000;

app.use(express.json());

const wppOptions = {
  puppeteer: {
    args: [
      '--no-sandbox',              // Desactiva el sandbox para entornos Docker
      '--disable-setuid-sandbox',  // Desactiva el sandbox setuid para contenedores
      '--disable-gpu',            // Desactiva la GPU (no necesaria en Koyeb)
      '--disable-dev-shm-usage',   // Evita problemas de memoria compartida en Docker
    ],
    timeout: 300000,              // Aumenta el timeout a 5 minutos (300,000 ms) para forzar la inicialización
    headless: true,               // Ejecuta Chromium en modo headless
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', // Usa Chromium instalado
    defaultViewport: null,        // Desactiva el viewport predeterminado
  },
  session: 'session',           // Nombre de la sesión
  catchQR: (base64Qr, asciiQR) => {
    console.log('QR Code generado:', asciiQR); // Imprime el QR en logs
  },
  logQR: true,                  // Habilita logs detallados del QR
  debug: true,                  // Activa modo de depuración para más información
  autoClose: false,             // Evita que la sesión se cierre automáticamente
  tokenStore: 'file',           // Almacena tokens en archivos
  tokenPath: '/app/tokens',     // Ruta para tokens, coincide con el Dockerfile
  waitForLogin: true,           // Espera a que se escanee el QR
  retries: 5,                   // Aumenta los reintentos a 5 para mayor robustez
};

// Crear el cliente WppConnect
create(wppOptions)
  .then((client) => {
    console.log("Cliente WppConnect conectado exitosamente");

    app.post("/send", async (req, res) => {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ error: "Faltan datos (phone y message son requeridos)" });
      }

      try {
        const formattedPhone = phone.replace(/[^\d]/g, '');
        if (formattedPhone.length < 10) {
          return res.status(400).json({ error: "Número de teléfono inválido" });
        }

        await client.sendText(`${formattedPhone}@c.us`, message);
        res.json({ success: true, message: "Mensaje enviado exitosamente" });
      } catch (error) {
        console.error("Error al enviar mensaje:", error);
        res.status(500).json({ error: "Error al enviar el mensaje", details: error.message });
      }
    });

    app.get("/status", (req, res) => {
      res.json({ status: "Conectado", client: client.isConnected() });
    });

    client.on('disconnected', () => {
      console.log('Cliente desconectado, intentando reconectar...');
      create(wppOptions).then(newClient => {
        client = newClient;
        console.log('Cliente reconectado exitosamente');
      }).catch(error => console.error('Error al reconectar:', error));
    });
  })
  .catch((error) => {
    console.error("Error al iniciar WppConnect:", error);
    process.exit(1); // Sale del proceso si no se puede conectar
  });

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

process.on('uncaughtException', (error) => {
  console.error('Error no manejado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rechazo no manejado:', reason);
});