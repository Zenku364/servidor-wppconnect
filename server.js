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
        '--disable-web-security',
        '--enable-features=NetworkService',
        '--disable-default-apps',
        '--disable-sync'
      ],
      headless: true,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
      timeout: 1800000, // 30 minutos
      handleSIGTERM: false,
      handleSIGHUP: false,
      protocolTimeout: 1200000 // 20 minutos para el protocolo CDP
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
      console.log('Recibida solicitud para enviar mensaje:', { groupId, message, timestamp: new Date().toISOString() });
      if (!groupId || !message) {
        return res.status(400).json({ error: "Falta el ID del grupo o el mensaje" });
      }
      try {
        console.log('Intentando enviar mensaje...');
        const startTime = Date.now();
        let timeoutOccurred = false;
        const result = await Promise.race([
          client.sendText(groupId, message),
          new Promise((_, reject) => setTimeout(() => {
            timeoutOccurred = true;
            reject(new Error('Timeout después de 28 minutos (próximo a 30 min de Render)'));
          }, 1680000)) // 28 minutos (1680000 ms), justo antes del límite de 30 min de Render
        ]);
        const endTime = Date.now();
        if (timeoutOccurred) {
          console.log(`Timeout detectado después de ${((endTime - startTime) / 1000).toFixed(2)} segundos.`);
          throw new Error('Timeout detectado en Render, revisa los recursos o el plan');
        } else {
          console.log(`Mensaje enviado con éxito en ${((endTime - startTime) / 1000).toFixed(2)} segundos. Resultado:`, result);
        }
        res.json({ success: true, method: "sendText", message: "Mensaje enviado al grupo con éxito", result });
      } catch (error) {
        console.log("Error enviando mensaje al grupo:", error.message, error.stack);
        if (error.message.includes('WPP is not defined') || error.message.includes('invariant') || error.message.includes('detached Frame') || error.message.includes('Invalid WID') || error.message.includes('Runtime.callFunctionOn timed out') || error.message.includes('Timeout')) {
          console.log('Reiniciando sesión por error crítico...');
          await client.initialize();
          await new Promise(resolve => setTimeout(resolve, 30000)); // Aumentamos a 30 segundos
          console.log('Reintentando enviar mensaje después de reinicio...');
          let retryResult;
          try {
            const retryStartTime = Date.now();
            retryResult = await Promise.race([
              client.sendText(groupId, message),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout después de reinicio')), 1680000))
            ]);
            const retryEndTime = Date.now();
            console.log(`Mensaje enviado después de reinicio en ${((retryEndTime - retryStartTime) / 1000).toFixed(2)} segundos. Resultado:`, retryResult);
            res.json({ success: true, method: "sendText", message: "Mensaje enviado después de reinicio", retryResult });
          } catch (retryError) {
            console.log("Error en reintento:", retryError.message, retryError.stack);
            return res.status(500).json({ error: "No se pudo enviar el mensaje al grupo después de reinicio", details: retryError.message });
          }
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

// Función para mantener la sesión viva verificando el estado con onStateChange
async function keepSessionAlive() {
  setInterval(async () => {
    if (client) {
      console.log('Manteniendo sesión activa con ping...');
      try {
        // Usamos onStateChange para verificar el estado
        let currentState = null;
        client.onStateChange((state) => {
          currentState = state;
          console.log('Estado actual en ping:', state);
        });
        await new Promise(resolve => setTimeout(resolve, 1000)); // Espera 1 segundo para capturar el estado
        if (currentState === 'DISCONNECTED' || currentState === 'UNLAUNCHED') {
          console.log('Sesión desconectada, reiniciando...');
          await client.initialize();
          await new Promise(resolve => setTimeout(resolve, 10000));
          console.log('Sesión reiniciada, verificando estado...');
          let newState = null;
          client.onStateChange((state) => {
            newState = state;
            console.log('Nuevo estado:', state);
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!newState || newState === 'DISCONNECTED' || newState === 'UNLAUNCHED') {
            console.log('Reinicio fallido, intentando nuevamente...');
            await client.initialize();
          }
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
          let newState = null;
          client.onStateChange((state) => {
            newState = state;
            console.log('Nuevo estado después de reinicio:', state);
          });
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (!newState || newState === 'DISCONNECTED' || newState === 'UNLAUNCHED') {
            console.log('Reinicio fallido, intentando nuevamente...');
            await client.initialize();
          }
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
