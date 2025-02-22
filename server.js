const express = require("express");
const { create } = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = 3000;

// Middleware para parsear JSON
app.use(express.json());

// Configuración avanzada para WppConnect y Puppeteer
const wppOptions = {
  puppeteer: {
    args: [
      '--no-sandbox',              // Desactiva el sandbox para entornos Docker
      '--disable-setuid-sandbox',  // Desactiva el sandbox setuid para contenedores
      '--disable-gpu',            // Desactiva la GPU (no necesaria en Koyeb)
      '--disable-dev-shm-usage',   // Evita problemas de memoria compartida en Docker
    ],
    timeout: 120000,              // Aumenta el timeout a 2 minutos para evitar timeouts en Koyeb
    headless: true,               // Ejecuta Chromium en modo headless (sin interfaz gráfica)
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium', // Usa Chromium instalado en el Dockerfile
    defaultViewport: null,        // Desactiva el viewport predeterminado para flexibilidad
  },
  session: 'session',           // Nombre de la sesión (puedes cambiarlo)
  catchQR: (base64Qr, asciiQR) => {
    console.log('QR Code generado:', asciiQR); // Imprime el QR en los logs para escanear
  },
  logQR: true,                  // Habilita logs detallados del QR
  debug: true,                  // Activa modo de depuración para más información
  autoClose: false,             // Evita que la sesión se cierre automáticamente
  tokenStore: 'file',           // Almacena tokens en archivos (puedes usar 'memory' si prefieres)
  tokenPath: '/app/tokens',     // Ruta para tokens, coincide con el Dockerfile
  waitForLogin: true,           // Espera a que se escanee el QR antes de continuar
  retries: 3,                   // Número de reintentos si falla la conexión
};

// Crear el cliente WppConnect con las opciones
create(wppOptions)
  .then((client) => {
    console.log("Cliente WppConnect conectado exitosamente");

    // Endpoint para enviar mensajes
    app.post("/send", async (req, res) => {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ error: "Faltan datos (phone y message son requeridos)" });
      }

      try {
        // Validar el formato del número de teléfono (incluye el código de país, ej. 5491234567890)
        const formattedPhone = phone.replace(/[^\d]/g, ''); // Elimina caracteres no numéricos
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

    // Endpoint para verificar el estado de la conexión
    app.get("/status", (req, res) => {
      res.json({ status: "Conectado", client: client.isConnected() });
    });

    // Manejar desconexiones o errores
    client.on('disconnected', () => {
      console.log('Cliente desconectado, intentando reconectar...');
      create(wppOptions).then(newClient => {
        client = newClient; // Reemplaza el cliente antiguo
        console.log('Cliente reconectado exitosamente');
      }).catch(error => console.error('Error al reconectar:', error));
    });
  })
  .catch((error) => {
    console.error("Error al iniciar WppConnect:", error);
    process.exit(1); // Sale del proceso si no se puede conectar
  });

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

// Manejo de errores globales
process.on('uncaughtException', (error) => {
  console.error('Error no manejado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rechazo no manejado:', reason);
});