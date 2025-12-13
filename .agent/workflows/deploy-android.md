---
description: Deploy Android App to Production
---

# Deploy Android App (FoodSense Mobile)

This workflow covers deploying the FoodSense Mobile Android app using Expo Application Services (EAS).

## Prerequisites

1. **Install EAS CLI** (if not already installed):
   ```bash
   npm install -g eas-cli
   ```

2. **Login to Expo Account**:
   ```bash
   eas login
   ```

3. **Android Keystore**: You'll need either an existing keystore or EAS will create one for you automatically.

## Step 1: Navigate to the Mobile App Directory

```bash
cd /Users/ravi/dev/firebase/foodsenseai-api/foodsense-mobile
```

## Step 2: Configure EAS Build

Initialize EAS in your project (this creates eas.json):

```bash
eas build:configure
```

## Step 3: Update app.json with Package Identifier

Before building, ensure your `app.json` has the Android package identifier:

Add the following to the `android` section in `app.json`:
```json
"android": {
  "package": "com.foodsense.mobile",
  "versionCode": 1,
  "adaptiveIcon": {
    "foregroundImage": "./assets/adaptive-icon.png",
    "backgroundColor": "#ffffff"
  },
  "edgeToEdgeEnabled": true
}
```

## Step 4: Build for Android

### Option A: Build APK for Testing/Internal Distribution
```bash
eas build -p android --profile preview
```

### Option B: Build AAB for Google Play Store
```bash
eas build -p android --profile production
```

## Step 5: Download and Test the Build

After the build completes:
1. EAS will provide a download link
2. Download the APK/AAB file
3. For APK: Install directly on an Android device for testing
4. For AAB: Upload to Google Play Console

## Step 6: Submit to Google Play Store (if ready)

```bash
eas submit -p android
```

You'll need:
- Google Play Console account
- App created in Google Play Console
- Service account JSON key

## Alternative: Build Locally (Advanced)

If you prefer to build locally instead of using EAS cloud builds:

```bash
# Install Android Studio and SDK first, then:
npx expo prebuild
npx expo run:android --variant release
```

## Notes

- **First-time setup**: EAS will guide you through creating credentials
- **Credentials**: EAS manages signing credentials automatically
- **Build time**: Cloud builds typically take 10-20 minutes
- **Testing**: Always test the APK on a real device before store submission
- **Version management**: Increment `version` and `versionCode` for each release

## Common Issues

1. **Missing package name**: Add `"package": "com.foodsense.mobile"` to android config
2. **Build fails**: Check that all assets (icon.png, splash-icon.png, etc.) exist
3. **Credentials error**: Run `eas credentials` to manage signing credentials
