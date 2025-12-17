const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const express = require("express");
const cors = require("cors");
const Busboy = require("busboy");

admin.initializeApp();
const db = admin.firestore();
const bucket = admin.storage().bucket();

const app = express();
app.use(cors({ origin: true }));

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Middleware to valid Firebase Auth Token
const validateAuthToken = async (req, res, next) => {
  console.log("Check if request is authorized with Firebase ID token");

  if (
    (!req.headers.authorization ||
      !req.headers.authorization.startsWith("Bearer ")) &&
    !(req.cookies && req.cookies.__session)
  ) {
    console.error(
      "No Firebase ID token was passed as a Bearer token in the Authorization header.",
      "Make sure you authorize your request by providing the following HTTP header:",
      "Authorization: Bearer <Firebase ID Token>",
      'or by passing a "__session" cookie.'
    );
    return res.status(403).send("Unauthorized");
  }

  let idToken;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    console.log('Found "Authorization" header');
    // Read the ID Token from the Authorization header.
    idToken = req.headers.authorization.split("Bearer ")[1];
  } else if (req.cookies) {
    console.log('Found "__session" cookie');
    // Read the ID Token from cookie.
    idToken = req.cookies.__session;
  } else {
    // No cookie
    return res.status(403).send("Unauthorized");
  }

  try {
    const decodedIdToken = await admin.auth().verifyIdToken(idToken);
    console.log("ID Token correctly decoded", decodedIdToken);
    req.user = decodedIdToken;
    next();
    return;
  } catch (error) {
    console.error("Error while verifying Firebase ID token:", error);
    return res.status(403).send("Unauthorized");
  }
};

app.use(validateAuthToken);

// Helper: Check and Update Quota
const checkQuota = async (uid, isAnonymous, email) => {
  const userRef = db.collection("user_profiles").doc(uid);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;

  // We use a transaction to ensure atomic read-modify-write
  return db.runTransaction(async (t) => {
    const doc = await t.get(userRef);
    let userData = doc.exists ? doc.data() : null;

    if (!userData) {
      // Create new profile
      userData = {
        identity: {
          authType: isAnonymous ? "anonymous" : "signed-in",
          email: email || null,
          dateSignedIn: admin.firestore.FieldValue.serverTimestamp(),
          uid: uid,
        },
        subscription: {
          status: "free", // Default to free
          datePaid: null,
          isGuest: isAnonymous,
        },
        usage: {
          currentMonth: currentMonth,
          scanCount: 0,
        },
      };
      // We set it here, but we also modify it below.
      // In a transaction, set() followed by logic on userData object is fine,
      // but we need to write the FINAL state to DB.
    }

    // Reset loop if month changed (handle both existing and new objects)
    if (userData.usage.currentMonth !== currentMonth) {
      userData.usage.currentMonth = currentMonth;
      userData.usage.scanCount = 0;
    }

    const scanCount = userData.usage.scanCount || 0;
    const subscriptionStatus = userData.subscription.status;
    const isGuest = userData.subscription.isGuest;

    let limit = 0;
    if (subscriptionStatus === "paid" || subscriptionStatus === "premium") {
      limit = Infinity;
    } else if (isGuest) {
      limit = 10;
    } else {
      // Signed in free user
      limit = 25;
    }

    if (scanCount >= limit) {
      // Determine error message
      const type = isGuest ? "Guest" : "Free Tier";
      throw new Error(
        `Quota Exceeded for ${type}. Limit: ${limit}, Used: ${scanCount}`
      );
    }

    // Prepare update
    // If doc didn't exist, we set the whole thing.
    // If it did, we update fields.
    const newCount = scanCount + 1;

    // Construct the object to save
    const updatedUserData = {
      ...userData,
      usage: {
        currentMonth: currentMonth,
        scanCount: newCount,
      },
    };

    t.set(userRef, updatedUserData, { merge: true });

    return { allowed: true, limit, currentUsage: newCount };
  });
};

// Express route to handle image analysis
app.post("/analyze-image", async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  // Ensure user is populated by middleware
  if (!req.user || !req.user.uid) {
    return res.status(403).send("Unauthorized: Missing User ID");
  }

  console.log(`Analyzing image for user: ${req.user.uid}`);

  try {
    // Check Quota first
    await checkQuota(
      req.user.uid,
      req.user.firebase.sign_in_provider === "anonymous",
      req.user.email
    );
  } catch (e) {
    console.error("Quota check failed", e);
    return res.status(403).json({ error: e.message });
  }

  const busboy = new Busboy({ headers: req.headers });
  let fileBuffer = null;
  let fileType = null;
  let fileName = null;

  busboy.on("field", (fieldname, val) => {
    // Ignore fields
  });

  busboy.on("file", (fieldname, file, info) => {
    const { filename, mimeType } = info;
    if (fieldname !== "image") {
      file.resume();
      return;
    }
    fileName = filename;
    fileType = mimeType;
    const buffers = [];
    file.on("data", (data) => buffers.push(data));
    file.on("end", () => {
      fileBuffer = Buffer.concat(buffers);
    });
  });

  busboy.on("finish", async () => {
    if (!fileBuffer) {
      return res.status(400).send({ error: "No image file provided" });
    }

    try {
      const uid = req.user.uid;
      const isAnonymous = req.user.firebase.sign_in_provider === "anonymous";

      // Determine Folder Path based on auth status
      const folder = isAnonymous ? "guestdata" : "userdata";
      const storagePath = `${folder}/${uid}/scans/${Date.now()}_${fileName}`;

      console.log(`Uploading file to ${storagePath}...`);
      const bucketFile = bucket.file(storagePath);

      await bucketFile.save(fileBuffer, {
        metadata: { contentType: fileType },
      });

      // Get reference URI
      const gcsUri = `gs://${bucket.name}/${storagePath}`;

      console.log("Analyzing with Gemini...");
      const prompt =
        "Describe this image in detail and identify key elements such as nutrition.";

      // Models to try
      const models = ["gemini-2.0-flash", "gemini-flash-latest"];
      let text = null;
      let usedModel = null;

      for (const modelName of models) {
        try {
          const model = genAI.getGenerativeModel({ model: modelName });
          const result = await model.generateContent([
            prompt,
            {
              inlineData: {
                data: fileBuffer.toString("base64"),
                mimeType: fileType || "image/jpeg",
              },
            },
          ]);
          const response = await result.response;
          text = response.text();
          usedModel = modelName;
          break;
        } catch (err) {
          console.log(`${modelName} failed: ${err.message}`);
        }
      }

      if (!text) {
        throw new Error("All AI models failed to generate content.");
      }

      // Store Scan Record
      const scanId = db.collection("scan_records").doc().id;
      await db.collection("scan_records").doc(scanId).set({
        ownerId: uid,
        imageUrl: gcsUri,
        storagePath: storagePath,
        analysisResult: text,
        model: usedModel,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        isPrivate: true,
      });

      return res.status(200).json({
        success: true,
        analysis: text,
        scanId: scanId,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  });

  busboy.end(req.rawBody);
});

exports.api = functions.https.onRequest(app);
