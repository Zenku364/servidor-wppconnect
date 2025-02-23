const express = require("express");
const { Client } = require("@wppconnect/wa-js");
const QRCode = require("qrcode"); // Para generar QR en base64

const app = express();
const PORT = 3000;

app.use(express.json());

let client;
let qrData;

const wppOptions = {
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
  logQR: false,        // Desactiva logs ASCII del QR
  debug: true,
  autoClose: false,
  tokenStore: 'file',
  tokenPath: '/app/tokens',
  waitForLogin: true,
  retries: 5,
};

client = new Client(wppOptions);

client.on('qr', async (qr) => {
  console.log('Evento QR recibido, generando QR en base64...');
  try {
    qrData = await QRCode.toDataURL(qr); // Genera el QR en base64
    console.log('QR generado, accede a /qr para verlo');
  } catch (error) {
    console.error('Error al generar QR:', error);
  }
});

client.on('ready', () => {
  console.log("Cliente WppConnect conectado exitosamente");
});

client.on('disconnected', () => {
  console.log('Cliente desconectado, intentando reconectar...');
  client.initialize().catch(error => console.error('Error al reconectar:', error));
});

client.initialize().catch(error => console.error('Error al inicializar:', error));

// Endpoint para obtener el QR como imagen
app.get('/qr', (req, res) => {
  if (qrData) {
    res.send(`<img src="${qrData}" alt="QR Code for WhatsApp">`);
  } else {
    res.status(404).send('QR no disponible, espera a que se genere');
  }
});

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

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});

process.on('uncaughtException', (error) => {
  console.error('Error no manejado:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Rechazo no manejado:', reason);
});