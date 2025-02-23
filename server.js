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
    ],
    timeout: 300000,  // 5 minutos
    headless: true,
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    defaultViewport: null,
    slowMo: 100,      // Para depuración
  },
  sessionId: 'session',
  catchQR: (base64Qr, asciiQR) => {
    console.log('QR Code generado (ASCII legible):');
    console.log(asciiQR);  // Mantiene el QR ASCII, pero asegúrate de que sea legible
    // Opcional: convierte base64Qr a una imagen si es necesario
  },
  logQR: true,
  debug: true,
  autoClose: false,
  tokenStore: 'file',
  tokenPath: '/app/tokens',
  waitForLogin: true,
  retries: 5,
});

// Endpoint para obtener el QR en base64 (sin usar qrcode, usando base64Qr directamente)
client.on('qr', (base64Qr) => {
  console.log('Evento QR recibido, QR en base64:', base64Qr.substring(0, 50) + '...');
  app.get('/qr', (req, res) => {
    res.send(`<img src="${base64Qr}" alt="QR Code for WhatsApp">`);
  });
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