const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

wppconnect
  .create({
    session: 'session',
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      headless: true,
      executablePath: '/usr/bin/chromium',
      timeout: 60000,
    },
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR generado. Visita http://tu-url-de-render:10000/qr para escanearlo.');
      global.qrCode = base64Qr; // Guardamos el QR en base64 para usarlo en el endpoint
    },
    logQR: true,
    autoClose: false,
    tokenStore: 'file',
    folderNameToken: './tokens',
  })
  .then((client) => {
    console.log("¡WhatsApp está conectado y listo!");
    global.client = client;

    client.on('disconnected', () => {
      console.log('WhatsApp se desconectó, intentando volver a conectar...');
      client.start();
    });

    app.post("/send-to-group", async (req, res) => {
      const { groupId, message } = req.body;
      if (!groupId || !message) {
        return res.status(400).json({ error: "Falta el ID del grupo o el mensaje" });
      }
      try {
        await client.sendText(groupId, message);
        res.json({ success: true, message: "Mensaje enviado al grupo con éxito" });
      } catch (error) {
        console.log("Error enviando mensaje al grupo:", error);
        res.status(500).json({ error: "No se pudo enviar el mensaje al grupo" });
      }
    });

    app.get("/groups", async (req, res) => {
      try {
        const groups = await client.getAllChatsGroups();
        res.json({ success: true, groups });
      } catch (error) {
        console.log("Error listando grupos:", error);
        res.status(500).json({ error: "No se pudieron listar los grupos" });
      }
    });

    app.get("/qr", (req, res) => {
      if (global.qrCode) {
        res.send(`<img src="data:image/png;base64,${global.qrCode}" alt="QR Code" />`);
      } else {
        res.status(404).send("No hay QR disponible aún. Espera a que se genere.");
      }
    });
  })
  .catch(error => console.log('Algo salió mal al empezar:', error));

app.listen(PORT, () => {
  console.log(`El programa está funcionando en el puerto ${PORT}`);
});