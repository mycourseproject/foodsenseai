# FoodSense AI - Design Summary

## 1. System Architecture
The application is built using a serverless architecture on Google Cloud Platform, leveraging Firebase for backend services and Expo for the cross-platform mobile frontend.

### Backend (Firebase Cloud Functions)
- **Runtime**: Node.js (v20+)
- **Framework**: Express.js wrapped in Firebase Cloud Functions (`https.onRequest`).
- **Functionality**: 
  - Receives multipart/form-data requests containing image files.
  - Temporarily stores images in Firebase Cloud Storage.
  - Generates content using the Google Gemini API.
  - Cleans up temporary storage after processing.
  - Returns analysis results to the client.

### Frontend (Mobile App)
- **Framework**: React Native with Expo.
- **Design System**: Modern "Glassmorphism" aesthetic with linear gradients and blur effects.
- **Key Features**:
  - Camera and Gallery integration using `expo-image-picker`.
  - Real-time image upload and analysis.
  - Raw response logging for debugging.
  - Graceful error handling for network or API failures.

## 2. AI Integration Strategy
- **Provider**: Google Gemini API via `@google/generative-ai` SDK.
- **Models**: Prioritizes `gemini-2.0-flash` for speed and accuracy, with fallbacks to `gemini-flash-latest` and `gemini-pro-latest`.
- **Optimization**: 
  - Uses stream-based file processing (via Busboy) to handle uploads efficiently.
  - Implements automatic MIME type detection and correction (defaulting to `image/jpeg`) to prevent API rejection.

## 3. Data Flow
1. **User Action**: User captures or selects a photo in the mobile app.
2. **Upload**: App sends a `POST` request to the Cloud Function URL.
3. **Processing**: 
   - Cloud Function parses the image.
   - Uploads to Cloud Storage bucket.
   - Calls Gemini API with the file reference and a prompt.
4. **Analysis**: Gemini analyses the visual data and returns a nutritional breakdown.
5. **Response**: Backend cleans up the file and sends the text response to the app.
6. **Display**: App renders the analysis in a scrollable, styled result card.
