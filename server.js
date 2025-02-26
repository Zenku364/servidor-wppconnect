const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = process.env.PORT || 3000; // Puerto flexible para local y Render

app.use(express.json());

wppconnect
  .create({
    session: 'session',
    puppeteerOptions: {
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      timeout: 120000, // Aumentamos a 2 minutos para evitar timeouts
    },
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR generado. Escanea este QR desde la consola:');
      console.log(asciiQR); // Muestra el QR en la consola como texto ASCII
    },
    logQR: false, // Desactivamos log adicional del QR
    autoClose: false,
    tokenStore: 'file',
    folderNameToken: './tokens',
  })
  .then((client) => {
    console.log("¡WhatsApp está conectado y listo!");
    global.client = client;

    client.onStateChange((state) => {
      console.log('Estado actual:', state); // Depuración del estado
      if (state === 'DISCONNECTED') {
        console.log('WhatsApp se desconectó, intentando volver a conectar...');
        client.initialize(); // Reintenta la conexión
      }
    });

    app.post("/send-to-group", async (req, res) => {
      const { groupId, message } = req.body;
      if (!groupId || !message) {
        return res.status(400).json({ error: "Falta el ID del grupo o el mensaje" });
      }
      try {
        await client.sendText(groupId, message);
        res.json({ success: true, method: "sendText", message: "Mensaje enviado al grupo con éxito" });
      } catch (error) {
        console.log("Error enviando mensaje al grupo:", error);
        res.status(500).json({ error: "No se pudo enviar el mensaje al grupo" });
      }
    });

    app.get("/groups", async (req, res) => {
      try {
        const chats = await client.getAllChats(); // Obtiene todos los chats
        const groups = chats.filter(chat => chat.isGroup); // Filtra solo los grupos
        res.json({ success: true, groups });
      } catch (error) {
        console.log("Error listando grupos:", error);
        res.status(500).json({ error: "No se pudieron listar los grupos" });
      }
    });
  })
  .catch(error => console.log('Algo salió mal al empezar:', error));

app.listen(PORT, () => {
  console.log(`El programa está funcionando en el puerto ${PORT}`);
});