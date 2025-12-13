# FoodSense AI - Prompt & Model Strategy Summary

## 1. AI Model Selection
We discovered that model availability varies by API project. To ensure reliability, we implemented a robust fallback mechanism:

1.  **Primary Model**: `gemini-2.0-flash` (Fastest, latest capabilities).
2.  **Fallbacks**: 
    - `gemini-flash-latest`
    - `gemini-pro-latest`
    - `gemini-2.0-flash-exp`

**Key Learning**: `gemini-1.5-flash` was consistently returning `404 Not Found` for this specific API key, necessitating the switch to `2.0-flash`.

## 2. System Instructions & Prompting
The backend uses a direct prompt strategy to guide the AI's persona and output format.

### The Persona
The AI is instructed to act as a **"nutritional expert AI"**.

### The Prompt
When an image is sent, the following context is implicitly provided to the model:
> "Analyze this image and identify the food items present. Provide a nutritional breakdown including estimated calories, macros (protein, carbs, fats), and a brief health assessment."

*(Note: The exact prompt text is embedded in the `functions/index.js` logic)*

## 3. Error Handling & Resilience
To handle the "Bad Request" errors observed during development, we refined the input prompting:
- **MIME Type Correction**: We force a fallback to `image/jpeg` if the file type cannot be strictly determined, ensuring the Gemini API always receives a valid MIME type.
- **Retry Logic**: The code iterates through the defined list of models. If one fails (e.g., due to overload or 404), it automatically attempts the next one without failing the user request immediately.
