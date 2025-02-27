const express = require("express");
const wppconnect = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = process.env.PORT || 3000; // Puerto flexible para local y Render

app.use(express.json());

let client; // Declaramos client como variable global

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
      timeout: 900000, // 15 minutos
      handleSIGTERM: false,
      handleSIGHUP: false,
      protocolTimeout: 600000 // Añadimos timeout para el protocolo CDP
    },
    catchQR: (base64Qr, asciiQR) => {
      console.log('QR generado. Escanea este QR desde la consola:');
      console.log(asciiQR);
    },
    logQR: false,
    autoClose: 0, // Desactiva autocierre
    tokenStore: 'file',
    folderNameToken: './tokens',
  })
  .then((c) => {
    client = c; // Asignamos el cliente aquí
    console.log("¡WhatsApp está conectado y listo!");
    keepSessionAlive(); // Inicia la función para mantener la sesión

    // Listener para cambios de estado dentro del .then()
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
        const result = await client.sendText(groupId, message);
        console.log('Mensaje enviado con éxito. Resultado:', result);
        res.json({ success: true, method: "sendText", message: "Mensaje enviado al grupo con éxito", result });
      } catch (error) {
        console.log("Error enviando mensaje al grupo:", error.message, error.stack);
        if (error.message.includes('WPP is not defined') || error.message.includes('invariant') || error.message.includes('detached Frame') || error.message.includes('Invalid WID')) {
          console.log('Reiniciando sesión por error crítico...');
          await client.initialize();
          await new Promise(resolve => setTimeout(resolve, 10000)); // Espera 10 segundos
          console.log('Reintentando enviar mensaje después de reinicio...');
          const retryResult = await client.sendText(groupId, message);
          console.log('Mensaje enviado después de reinicio. Resultado:', retryResult);
          res.json({ success: true, method: "sendText", message: "Mensaje enviado después de reinicio", retryResult });
        } else {
          res.status(500).json({ error: "No se pudo enviar el mensaje al grupo", details: error.message });
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

// Función para mantener la sesión viva verificando el estado
async function keepSessionAlive() {
  setInterval(async () => {
    if (client) {
      console.log('Manteniendo sesión activa con ping...');
      try {
        // Usamos getState para verificar si el cliente está conectado
        const state = await client.getState();
        console.log('Estado actual en ping:', state);
        if (state === 'DISCONNECTED' || state === 'UNLAUNCHED') {
          console.log('Sesión desconectada, reiniciando...');
          await client.initialize();
          await new Promise(resolve => setTimeout(resolve, 10000));
          console.log('Sesión reiniciada, verificando estado...');
          const newState = await client.getState();
          console.log('Nuevo estado:', newState);
        } else {
          console.log('Ping exitoso, sesión activa');
        }
      } catch (error) {
        console.log('Error en ping:', error);
        console.log('Reiniciando sesión por error...');
        await client.initialize();
        await new Promise(resolve => setTimeout(resolve, 10000));
        console.log('Sesión reiniciada, verificando estado...');
        try {
          const newState = await client.getState();
          console.log('Nuevo estado después de reinicio:', newState);
        } catch (retryError) {
          console.log('Error después de reinicio:', retryError);
        }
      }
    }
  }, 300000); // Cada 5 minutos
}

// Manejo de señal SIGTERM para intentar cerrar gracefully
process.on('SIGTERM', () => {
  console.log('Recibida señal SIGTERM, intentando cerrar gracefully...');
  if (client) {
    client.close().then(() => {
      console.log('Sesión cerrada gracefully');
      process.exit(0);
    }).catch(err => {
      console.log('Error al cerrar sesión:', err);
      process.exit(1);
    });
  } else {
    process.exit(0);
  }
});

app.listen(PORT, () => {
  console.log(`El programa está funcionando en el puerto ${PORT}`);
});
