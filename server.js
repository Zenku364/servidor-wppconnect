const express = require("express");
const { create } = require("@wppconnect-team/wppconnect");

const app = express();
const PORT = 3000;

app.use(express.json());

create()
  .then((client) => {
    console.log("Cliente conectado");

    app.post("/send", async (req, res) => {
      const { phone, message } = req.body;

      if (!phone || !message) {
        return res.status(400).json({ error: "Faltan datos" });
      }

      try {
        await client.sendText(`${phone}@c.us`, message);
        res.json({ success: true, message: "Mensaje enviado" });
      } catch (error) {
        res.status(500).json({ error: "Error al enviar" });
      }
    });
  })
  .catch((error) => console.log("Error al iniciar WPPConnect", error));

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
