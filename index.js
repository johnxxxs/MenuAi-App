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

      const url =
        req.body.url;

      const pdfFile =
        req.files?.pdfFile?.[0];

      const imageFile =
        req.files?.imageFile?.[0];

      console.log(imageFile);

      let text = "";



      // URL MODE

      if (url) {

        console.log("URL RECEIVED");

        const response =
          await axios.get(url);

        const html =
          response.data;

        const $ =
          cheerio.load(html);

        text =
          $("body").text();

      }



      // IMAGE MODE

      else if (imageFile) {

        console.log("IMAGE RECEIVED");

        const imageBuffer =
          fs.readFileSync(imageFile.path);

        const base64Image =
          imageBuffer.toString("base64");

        const mimeType =
          mime.lookup(imageFile.originalname)
          || "image/jpeg";

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
      "price": ""
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

                    text:
"Extract this restaurant menu"
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

          error: "No URL, image or PDF received"

        });

      }



      // TEXT TO OPENAI

      const menuText =
        text.substring(0, 40000);

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
      "price": ""
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

      const parsedMenu =
        completion.choices[0].message.content;

      return res.json({

        success: true,

        parsedMenu: parsedMenu

      });

    } catch (error) {

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
    
    const category =
  req.body.category;

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

Incluye:

- descripción
- ingredientes
- historia
- curiosidades gastronómicas

La respuesta debe ser agradable de leer.
`
          },

          {
            role: "user",

            content: `
Categoría:
${category}

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

// ================================
// TRANSLATE MENU
// ================================

app.post("/translate", async (req, res) => {

  try {

    const language =
      req.body.language;

    const menu =
      req.body.menu;

    const originalMenu =
  JSON.parse(JSON.stringify(menu));

    const menuJson =
  JSON.stringify(menu, null, 2);

    console.log("==============");
    console.log("TRANSLATE");
    console.log(language);

    const completion =
  await openai.chat.completions.create({

    model: "gpt-4.1-mini",

    messages: [

      {

        role: "system",

        content: `
You are a professional restaurant menu translator.

Translate the following menu into the requested language.

IMPORTANT:

- Return ONLY valid JSON.
- Do NOT use markdown.
- Do NOT write \`\`\`json.
- Keep exactly the same JSON structure.
- Do NOT modify prices.
- Translate:
  - category
  - name
  - description

`

      },

      {

        role: "user",

        content:

`Target language:

${language}

Menu:

${menuJson}`

      }

    ]

  });

const translatedMenu =
  completion.choices[0].message.content
    .replace(/```json/g,"")
    .replace(/```/g,"")
    .trim();

const translated =
  JSON.parse(translatedMenu);

// Añadimos el nombre original
translated.forEach((item, index) => {

  item.name_original =
    originalMenu[index].name;

});

return res.json({

  success: true,

  menu: translated

});
    
  } catch (error) {

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
