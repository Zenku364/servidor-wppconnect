const express = require("express");
const { Client } = require("@wppconnect/wa-js");

const app = express();
const PORT = 3000;

app.use(express.json());

const client = new Client({
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--single-process',  // Añadido para ahorrar memoria
    ],
    timeout: 300000,  // 5 minutos
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    defaultViewport: null,
    slowMo: 0,  // Reducido a 0 para ahorrar recursos
  },
  sessionId: 'session',
  catchQR: (base64Qr, asciiQR) => {
    console.log('QR Code generado:', asciiQR);
  },
  logQR: true,
  debug: true,
  autoClose: false,
  tokenStore: 'file',
  tokenPath: '/app/tokens',
  waitForLogin: true,
  retries: 5,
});

client.on('qr', (qr) => {
  console.log('Evento QR recibido:', qr);
});

client.on('ready', () => {
  console.log("Cliente WppConnect conectado exitosamente");
});

client.initialize().catch(error => console.error('Error al inicializar:', error));

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
  client.initialize();
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