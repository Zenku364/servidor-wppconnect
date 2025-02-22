const express = require("express");
const { create } = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = 3000;

app.use(express.json());

const wppOptions = {
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
    ],
    timeout: 120000,              // Aumenta el timeout a 2 minutos
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    defaultViewport: null,
  },
  session: 'session',
  catchQR: (base64Qr, asciiQR) => {
    console.log('QR Code generado:', asciiQR);
  },
  logQR: true,
  debug: true,
  autoClose: false,
  tokenStore: 'file',
  tokenPath: '/app/tokens',
  waitForLogin: true,
  retries: 3,
};

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
    process.exit(1);
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