const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const cors = require("cors");
const Busboy = require("busboy");

admin.initializeApp();

const app = express();
app.use(cors());

// Add request logging middleware
app.use((req, res, next) => {
  console.log("=== REQUEST INFO START ===");
  console.log(`Request URL: ${req.originalUrl}`);
  console.log(`Request Method: ${req.method}`);
  console.log(`Content-Type: ${req.headers["content-type"]}`);
  console.log(`Content-Length: ${req.headers["content-length"]}`);
  console.log("=== REQUEST INFO END ===");
  next();
});

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
console.log("Gemini API initialized");

// Initialize Cloud Storage
const bucket = admin.storage().bucket();
console.log(`Storage bucket initialized: ${bucket.name}`);

// Express route to handle image analysis
app.post("/analyze-image", (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const busboy = new Busboy({ headers: req.headers });
  const fields = {};
  let fileBuffer = null;
  let fileType = null;
  let fileName = null;

  busboy.on("field", (fieldname, val) => {
    console.log(`Processed field ${fieldname}: ${val}.`);
    fields[fieldname] = val;
  });

  busboy.on("file", (fieldname, file, info) => {
    const { filename, mimeType } = info;
    console.log(`Processed file ${filename}`);

    if (fieldname !== "image") {
      file.resume();
      return;
    }

    fileName = filename;
    fileType = mimeType;
    const buffers = [];

    file.on("data", (data) => {
      buffers.push(data);
    });

    file.on("end", () => {
      fileBuffer = Buffer.concat(buffers);
    });
  });

  busboy.on("finish", async () => {
    if (!fileBuffer) {
      return res.status(400).send({ error: "No image file provided" });
    }

    try {
      console.log(`Uploading file ${fileName} to Storage...`);
      const storagePath = `uploads/${Date.now()}_${fileName}`;
      const bucketFile = bucket.file(storagePath);

      await bucketFile.save(fileBuffer, {
        metadata: { contentType: fileType },
      });

      console.log("File uploaded. Analyzing with Gemini...");

      const prompt =
        "Describe this image in detail and identify key elements such as nutrition.";

      // List of models to try in order of preference
      // Updated based on available models for the current API key
      const models = [
        "gemini-2.0-flash",
        "gemini-flash-latest",
        "gemini-pro-latest",
        "gemini-2.0-flash-exp",
      ];

      const errorDetails = [];

      for (const modelName of models) {
        try {
          console.log(`Attempting analysis with model: ${modelName}`);
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: fileType || "image/jpeg", // Fallback to jpeg if null
              },
            },
          ]);
          const response = await result.response;
          const text = response.text();
          console.log(`Success with model ${modelName}:`, text);

          // Cleanup
          await bucketFile.delete();

          return res.status(200).json({
            analysis: text,
            model: modelName,
          });
        } catch (err) {
          console.error(`Failed with model ${modelName}:`, err.message);

          errorDetails.push(`${modelName}: ${err.message}`);
          // Continue to next model
        }
      }

      // If loop finishes without returning, all models failed
      // Cleanup even if all models failed
      if (bucketFile) {
        try {
          await bucketFile.delete();
        } catch (e) {
          console.log("File already deleted or not found");
        }
      }

      throw new Error(
        `All AI models failed. Details: ${JSON.stringify(errorDetails)}`
      );
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  busboy.end(req.rawBody);
});

// Export the Express app as a Firebase Cloud Function
exports.api = functions.https.onRequest(app);
console.log("Firebase Cloud Function initialized");
