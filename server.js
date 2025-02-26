const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = process.env.PORT || 3000; // Puerto flexible para local y Render

app.use(express.json());

wppconnect
  .create({
    session: 'session',
    puppeteerOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--disable-extensions',
        '--single-process',
        '--no-zygote',
        '--disable-background-networking',
        '--enable-low-end-device-mode',
        '--ignore-certificate-errors',
        '--no-first-run'
      ],
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      timeout: 600000, // 10 minutos
      handleSIGTERM: false,
      handleSIGHUP: false,
    },
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR generado. Escanea este QR desde la consola:');
      console.log(asciiQR);
    },
    logQR: false,
    autoClose: false,
    tokenStore: 'file',
    folderNameToken: './tokens',
  })
  .then((client) => {
    console.log("¡WhatsApp está conectado y listo!");
    global.client = client;

    client.onStateChange((state) => {
      console.log('Estado actual:', state);
      if (state === 'DISCONNECTED') {
        console.log('WhatsApp se desconectó, intentando volver a conectar...');
        client.initialize();
      }
    });

    app.post("/send-to-group", async (req, res) => {
      const { groupId, message } = req.body;
      console.log('Recibida solicitud para enviar mensaje:', { groupId, message });
      if (!groupId || !message) {
        return res.status(400).json({ error: "Falta el ID del grupo o el mensaje" });
      }
      try {
        console.log('Intentando enviar mensaje...');
        await client.sendText(groupId, message);
        console.log('Mensaje enviado con éxito');
        res.json({ success: true, method: "sendText", message: "Mensaje enviado al grupo con éxito" });
      } catch (error) {
        console.log("Error enviando mensaje al grupo:", error);
        if (error.message.includes('WPP is not defined') || error.message.includes('invariant') || error.message.includes('detached Frame')) {
          console.log('Reiniciando sesión por error crítico...');
          await client.initialize();
          await new Promise(resolve => setTimeout(resolve, 10000)); // Espera 10 segundos
          console.log('Reintentando enviar mensaje después de reinicio...');
          await client.sendText(groupId, message);
          res.json({ success: true, method: "sendText", message: "Mensaje enviado después de reinicio" });
        } else {
          res.status(500).json({ error: "No se pudo enviar el mensaje al grupo" });
        }
      }
    });

    app.get("/groups", async (req, res) => {
      try {
        const chats = await client.getAllChats();
        const groups = chats.filter(chat => chat.isGroup);
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