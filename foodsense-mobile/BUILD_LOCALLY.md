# Build Android App Locally (No Expo Account Required)

## Overview
Build your FoodSense Mobile app locally without needing an Expo account or cloud services.

## Prerequisites

### 1. Install Android Studio
Download from: https://developer.android.com/studio

### 2. Install Java Development Kit (JDK)
```bash
# Check if you have Java 17 installed
java -version

# If not, install via Homebrew
brew install openjdk@17

# Add to your PATH (add to ~/.zshrc)
export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
```

### 3. Set up Android SDK
After installing Android Studio:
1. Open Android Studio
2. Go to Settings/Preferences → Appearance & Behavior → System Settings → Android SDK
3. Install:
   - Android SDK Platform 34 (or latest)
   - Android SDK Build-Tools 34.0.0 (or latest)
   - Android Emulator (optional, for testing)

### 4. Set Environment Variables
Add to your `~/.zshrc` (or `~/.bash_profile`):

```bash
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
export PATH=$PATH:$ANDROID_HOME/tools
export PATH=$PATH:$ANDROID_HOME/tools/bin
```

Then run: `source ~/.zshrc`

## Build Steps

### Step 1: Install Dependencies
```bash
cd /Users/ravi/dev/firebase/foodsenseai-api/foodsense-mobile
npm install
```

### Step 2: Prebuild Native Android Project
This generates the native Android project from your Expo configuration:

```bash
npx expo prebuild --platform android
```

This creates an `android/` directory with native Android code.

### Step 3: Build Debug APK (for testing)
```bash
# Build a debug APK
npx expo run:android --variant debug
```

Or use Gradle directly:
```bash
cd android
./gradlew assembleDebug
```

The APK will be at: `android/app/build/outputs/apk/debug/app-debug.apk`

### Step 4: Build Release APK (for distribution)
```bash
# Build a release APK
npx expo run:android --variant release
```

Or use Gradle:
```bash
cd android
./gradlew assembleRelease
```

The APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### Step 5: Install on Device
```bash
# Connect your Android device via USB, then:
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

## Signing the Release Build

For a production release, you need to sign the APK:

### Generate a Keystore
```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore foodsense-release.keystore \
  -alias foodsense \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

### Configure Signing in android/app/build.gradle

Add after `android {`:
```gradle
signingConfigs {
    release {
        storeFile file('../../foodsense-release.keystore')
        storePassword 'YOUR_STORE_PASSWORD'
        keyAlias 'foodsense'
        keyPassword 'YOUR_KEY_PASSWORD'
    }
}

buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled false
        proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
    }
}
```

## Quick Commands Reference

```bash
# Check prerequisites
java -version
echo $ANDROID_HOME
adb --version

# Clean build
cd android && ./gradlew clean

# Build debug APK
npx expo run:android --variant debug

# Build release APK
npx expo run:android --variant release

# List connected devices
adb devices

# Install APK
adb install path/to/app.apk

# Uninstall app
adb uninstall com.foodsense.mobile

# View logs
adb logcat | grep "FoodSense"
```

## Troubleshooting

### Error: "ANDROID_HOME is not set"
**Solution**: Set the environment variable as shown above

### Error: "SDK not found"
**Solution**: Install Android SDK via Android Studio

### Error: "No connected devices"
**Solution**: 
- Connect device via USB
- Enable USB debugging on device
- Trust the computer on device

### Error: "Build failed - missing dependencies"
**Solution**: 
```bash
cd android
./gradlew --refresh-dependencies
```

### Error: "Unable to install APK"
**Solution**:
```bash
# Uninstall existing version first
adb uninstall com.foodsense.mobile
# Then install
adb install app.apk
```

## Advantages of Local Building

✅ No Expo account required  
✅ Unlimited builds  
✅ Full control over build process  
✅ Faster iteration (no cloud upload)  
✅ Works offline  
✅ Can customize native code  

## Disadvantages

❌ More complex setup  
❌ Need Android Studio & SDK  
❌ Manual credential management  
❌ Requires more disk space (~10-15GB)  

## Alternative: APK Without Full Setup

If you just want a quick APK for testing without setting up everything:

1. **Use expo-dev-client** (still needs some Expo setup but simpler)
2. **Ask someone with Android Studio** to build for you
3. **Use EAS Build** with an Expo account (easiest for occasional builds)

Choose the method that best fits your needs!
