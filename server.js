const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

let client;

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
        '--no-first-run',
        '--disable-web-security'
      ],
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      timeout: 900000,
      handleSIGTERM: false,
      handleSIGHUP: false,
      protocolTimeout: 900000
    },
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR generado. Escanea este QR desde la consola:');
      console.log(asciiQR);
    },
    logQR: false,
    autoClose: 0,
    tokenStore: 'file',
    folderNameToken: './tokens',
  })
  .then((c) => {
    client = c;
    console.log("¡WhatsApp está conectado y listo!");

    client.onStateChange((state) => {
      console.log('Estado actual:', state);
      if (state === 'DISCONNECTED') {
        console.log('WhatsApp se desconectó, intentando volver a conectar...');
        client.initialize();
      }
    });

    app.post("/send-to-group", async (req, res) => {
      const { groupId, message } = req.body;
      if (!groupId || !message) {
        return res.status(400).json({ error: "Falta el ID del grupo o el mensaje" });
      }
      try {
        const result = await client.sendText(groupId, message);
        res.json({ success: true, message: "Mensaje enviado al grupo con éxito", result });
      } catch (error) {
        console.error("Error enviando mensaje al grupo:", error);
        res.status(500).json({ error: "No se pudo enviar el mensaje al grupo", details: error.message });
      }
    });

    app.get("/groups", async (req, res) => {
      try {
        const chats = await client.getAllChats();
        const groups = chats.filter(chat => chat.isGroup);
        res.json({ success: true, groups });
      } catch (error) {
        console.error("Error listando grupos:", error);
        res.status(500).json({ error: "No se pudieron listar los grupos" });
      }
    });

    setInterval(async () => {
      if (client) {
        try {
          const state = await client.getConnectionState();
          console.log('Estado de conexión actual:', state);
          if (state === 'DISCONNECTED' || state === 'UNLAUNCHED') {
            console.log('Intentando reiniciar la sesión...');
            await client.initialize();
          }
        } catch (error) {
          console.error('Error verificando el estado:', error);
          try {
            await client.initialize();
          } catch (retryError) {
            console.error('Error al reiniciar la sesión:', retryError);
          }
        }
      }
    }, 300000);

  })
  .catch(error => console.error('Error al iniciar wppconnect:', error));

process.on('SIGTERM', async () => {
  console.log('Recibida señal SIGTERM, cerrando sesión...');
  try {
    if (client) {
      await client.close();
      console.log('Sesión cerrada correctamente.');
    }
  } catch (error) {
    console.error('Error al cerrar la sesión:', error);
  } finally {
    process.exit(0);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor funcionando en el puerto ${PORT}`);
});
