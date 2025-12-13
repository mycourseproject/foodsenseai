# FoodSense Mobile - Android Deployment Guide

## Overview
This guide covers deploying the FoodSense Mobile Android app to production using Expo Application Services (EAS).

## What's Been Set Up

✅ **Completed:**
- EAS CLI installed globally
- `app.json` updated with Android package identifier (`com.foodsense.mobile`)
- Android version code set to 1
- API test scripts created for backend testing

## Next Steps for Android Deployment

### Step 1: Login to Expo Account

The EAS build configuration is waiting for you to log in. You have two options:

**Option A: Interactive Login (Current State)**
The terminal is waiting for your credentials. Enter your Expo account details:
```bash
# The command is already running and waiting for:
# - Email or username
# - Password
```

**Option B: Cancel and Use Alternative Login**
```bash
# Press Ctrl+C to cancel the current command, then:
eas login --help  # See all login options
eas login         # Standard login
```

### Step 2: Complete EAS Build Configuration

After logging in, the `eas build:configure` command will:
- Create an `eas.json` file in your project
- Set up build profiles (development, preview, production)

### Step 3: Build the Android App

Once configured, you can build:

**For Testing (APK - can install directly on device):**
```bash
cd /Users/ravi/dev/firebase/foodsenseai-api/foodsense-mobile
eas build -p android --profile preview
```

**For Production (AAB - for Google Play Store):**
```bash
cd /Users/ravi/dev/firebase/foodsenseai-api/foodsense-mobile
eas build -p android --profile production
```

### Step 4: Monitor the Build

- EAS will upload your project and build it in the cloud
- Build time: typically 10-20 minutes
- You'll get a URL to monitor progress
- Once complete, you'll receive a download link

### Step 5: Download and Test

- Download the APK/AAB from the provided link
- **For APK**: Install on Android device via ADB or direct transfer
- **For AAB**: Upload to Google Play Console

### Step 6: Submit to Google Play Store (Optional)

If you're ready to publish:
```bash
eas submit -p android
```

You'll need:
- Google Play Developer account
- App created in Google Play Console
- Service account JSON key

## Project Configuration

### app.json
```json
{
  "expo": {
    "name": "foodsense-mobile",
    "slug": "foodsense-mobile",
    "version": "1.0.0",
    "android": {
      "package": "com.foodsense.mobile",
      "versionCode": 1,
      ...
    }
  }
}
```

### eas.json (will be created)
This file will be automatically created with build profiles:
- **development**: For development builds
- **preview**: For testing (APK)
- **production**: For store submission (AAB)

## API Testing

Before deploying the mobile app, you can test the backend API:

### Install Dependencies
```bash
cd /Users/ravi/dev/firebase/foodsenseai-api/functions
npm install
```

### Run Simple Test
```bash
npm run test-api-simple
```

### Run Full Test Suite
```bash
npm run test-api
```

### Custom Image Test
```bash
API_URL=https://api-2rzo5otiva-uc.a.run.app/analyze-image \
IMAGE_PATH=/path/to/your/image.jpg \
npm run test-api-simple
```

## Troubleshooting

### Issue: "Expo account required"
**Solution**: Complete the login process in the terminal

### Issue: "No credentials found"
**Solution**: EAS will guide you through creating new credentials automatically

### Issue: "Build failed"
**Solution**: 
- Check that all assets exist (icon.png, splash-icon.png, adaptive-icon.png)
- Review build logs for specific errors
- Ensure package.json dependencies are correct

### Issue: "Cannot find module 'form-data'"
**Solution**: 
```bash
cd /Users/ravi/dev/firebase/foodsenseai-api/functions
npm install
```

## Important Notes

1. **Version Management**: 
   - Increment `version` (e.g., "1.0.0" → "1.0.1") for minor updates
   - Increment `versionCode` (e.g., 1 → 2) for every new build

2. **Signing Credentials**:
   - EAS manages these automatically
   - Stored securely in Expo's infrastructure
   - Can be downloaded if needed via `eas credentials`

3. **Build Limits**:
   - Free plan: Limited builds per month
   - Paid plans: More build capacity

4. **Testing**:
   - Always test APK on real device before production
   - Test on multiple Android versions if possible
   - Verify API connectivity works in production

## Quick Reference

```bash
# Login to EAS
eas login

# Configure EAS
eas build:configure

# Build for testing
eas build -p android --profile preview

# Build for production
eas build -p android --profile production

# Check build status
eas build:list

# Download build
# (Use the URL provided after build completes)

# Manage credentials
eas credentials

# Submit to Play Store
eas submit -p android
```

## Current Terminal State

There's a terminal waiting for your Expo login credentials at:
```
/Users/ravi/dev/firebase/foodsenseai-api/foodsense-mobile
```

Enter your Expo email/username to continue the build configuration.
