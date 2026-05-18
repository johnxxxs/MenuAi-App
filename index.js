console.log(
  "OPENAI:",
  process.env.OPENAI_API_KEY
)

require("dotenv").config();

const fs = require("fs");
const pdf = require("pdf-parse").default;
const express = require("express");
const path = require("path");
const multer = require("multer");
const axios = require("axios");
const cheerio = require("cheerio");
const OpenAI = require("openai");

const app = express();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.use(express.json());

app.use(express.static("public"));

const upload = multer({
  dest: "uploads/"
});


// HOME

app.get("/", (req, res) => {

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );

});


// PROCESS

app.post(
  "/process",
  upload.fields([
    { name: "pdfFile", maxCount: 1 },
    { name: "imageFile", maxCount: 1 }
  ]),
  async (req, res) => {

    try {

      const url = req.body.url;

      const pdfFile =
  req.files?.pdfFile?.[0];

      console.log("URL RECEIVED:");
      console.log(url);

      // VALIDATE URL

      

      // DOWNLOAD HTML

      let text = "";

// URL MODE

if (url) {

  const response =
    await axios.get(url);

  const html =
    response.data;

  console.log("HTML DOWNLOADED");

  const $ =
    cheerio.load(html);

  text =
    $("body").text();

}

// PDF MODE

else if (pdfFile) {

  console.log("PDF RECEIVED");

  const pdfBuffer =
    fs.readFileSync(pdfFile.path);

  const pdfData =
    await pdf(pdfBuffer);

  text =
    pdfData.text;

}

else {

  return res.json({

    success: false,

    error: "No URL or PDF received"

  });

}


      // EXTRACT TEXT

     
      console.log("TEXT EXTRACTED");

      // LIMIT TEXT

      const menuText =
        text.substring(0, 5000);

      console.log("SENDING TO OPENAI");

      // OPENAI

      const completion =
        await openai.chat.completions.create({

          model: "gpt-4.1-mini",

          messages: [

            {
              role: "system",
              content: `
You are a restaurant menu parser.

Extract restaurant menu items into JSON.

Return ONLY JSON.

Structure:

{
  "items": [
    {
      "category": "",
      "name": "",
      "description": "",
      "price": "",
      "image_url": ""
    }
  ]
}
`
            },

            {
              role: "user",
              content: menuText
            }

          ]

        });

      console.log("OPENAI RESPONSE RECEIVED");

      const parsedMenu =
        completion.choices[0].message.content;

      // RESPONSE

      return res.json({

        success: true,

        parsedMenu: parsedMenu

      });

    } catch (error) {

      console.log("ERROR:");
      console.log(error);

      return res.json({

        success: false,

        error: error.message

      });

    }

  }
);
// DISH INFO

app.post("/dish-info", async (req, res) => {

  try {

    const dishName =
      req.body.dishName;

    const restaurant =
      req.body.restaurant;

    console.log("DISH INFO REQUEST");

    console.log(dishName);

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [

          {
            role: "system",
            content: `
Eres un asistente gastronómico experto.

Responde SIEMPRE en español castellano.

Explica los platos de manera cercana, profesional y cultural. Hay platos que no tienen lo que son solo contienen la descripcion, por ejemplo, Categoria: Bocadillos
Nombre de plato: Tortilla de patatas... Significa que el lplato es bocadillo de Tortilla de PAtatas, si el plato esta incompleto en el nombre mira a la categoria 
que le corresponde para que asocies bien el tipo de plato que es.

En el texto deveutlo Incluye:

- descripción del plato
- ingredientes típicos
- origen o historia
- curiosidades gastronómicas
- relación cultural con la ciudad o región si aplica

La respuesta debe ser agradable de leer y orientada a clientes de restaurantes.
`
          },

          {
            role: "user",
            content: `
Plato:
${dishName}

Restaurante:
${restaurant}


`
          }

        ]

      });

    const info =
      completion.choices[0].message.content;

    return res.json({

      success: true,

      info: info

    });

  } catch (error) {

    console.log(error);

    return res.json({

      success: false,

      error: error.message

    });

  }

});

// SERVER

app.listen(3000, () => {

  console.log(
    "MenuAi App running on http://localhost:3000"
  );

});
