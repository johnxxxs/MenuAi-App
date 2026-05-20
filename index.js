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
const mime = require("mime-types");

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

      const imageFile =
  req.files?.imageFile?.[0];



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

  ///Analizar Imagen///

  else if (imageFile) {

  console.log("IMAGE RECEIVED");

  const imageBuffer =
    fs.readFileSync(imageFile.path);

  const base64Image =
    imageBuffer.toString("base64");

  const mime.lookup(imageFile.originalname);

  console.log("SENDING IMAGE TO OPENAI");

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
          content: [

            {
              type: "text",
              text: "Extract this restaurant menu"
            },

            {
              type: "image_url",

              image_url: {

                url:
`data:${mimeType};base64,${base64Image}`

              }

            }

          ]

        }

      ]

    });

  const parsedMenu =
    completion.choices[0].message.content;

  return res.json({

    success: true,

    parsedMenu: parsedMenu

  });

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
        text.substring(0, 40000);

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

Explica los platos de manera cercana, profesional y cultural.

Analiza tambien que tipo de restaurante es viendo todos los platos de su carta en el enlace original de la request.

Da descripcion basada no solo en el plato si no tambien incluyendo el tipo de restaurante que es por ejemplo, 
no es lo mismo una ensalada mixta Italiana, que en un restaurante Español

En el texto devuelto Incluye:

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
