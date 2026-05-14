# Post-Migration Handoff Summary

This document summarizes the recent architectural changes made to transition Shroud Wallet to Expo (SDK 55) and outlines the exact next steps required to build and deploy the app.

## 📦 Recent Commits & Changes

### 1. File System & Media Migration
- **Replaced Packages:** `react-native-fs`, `react-native-image-picker`, `@react-native-documents/picker`
- **Expo Equivalents:** `expo-file-system`, `expo-image-picker`, `expo-document-picker`
- **Impact:** Converted legacy synchronous file operations (like reading Realm databases or saving PSBTs) into modern asynchronous Expo APIs. This ensures compatibility with Android 13+ storage scoping rules and iOS file sandboxing.

### 2. Notifications & Permissions Migration
- **Replaced Packages:** `react-native-push-notification`, `@react-native-community/push-notification-ios`, `react-native-permissions`
- **Expo Equivalents:** `expo-notifications`, `expo-camera`
- **Impact:** Completely refactored the GroundControl push notification logic in `modules/notifications.ts`. Camera permissions for the QR scanner were streamlined using Expo Camera.

### 3. Environment & Configuration Synchronization
- App configuration (`app.json`) and build profiles (`eas.json`) were generated.
- Missing peer dependencies (`expo-font`, `react-native-worklets`) were installed to ensure stable native compilation.
- Extraneous configurations causing schema validation errors (like `ios.deploymentTarget`) were removed.
- Adjusted local environment by appending NVM configurations to your `~/.zshrc`.

---

## 🚀 What You Need to Do Next

The codebase is structurally ready for Expo SDK 55, but requires developer secrets to compile via Expo Application Services (EAS).

### Step 1: Push Changes to GitHub
Commit any lingering local changes and push the `project-migration` branch to GitHub so the maintainer can pull the code.

### Step 2: Handoff to Maintainer (Secrets Injection)
Pass the repository to the maintainer. They must execute the following via the Expo CLI (`npx eas-cli`):
1. **Initialize Project ID:** Run `eas init` to link the repository to the Expo Dashboard (this replaces `"YOUR_EAS_PROJECT_ID"` in `app.json`).
2. **Setup Notifications:** Place the `GoogleService-Info.plist` (iOS) and `google-services.json` (Android) in the project. Run `eas credentials` to upload the APNs Auth Key and FCM Server Key.
3. **Generate Keystores/Certificates:** Run `eas credentials` to generate iOS Distribution Certificates and Android Keystores for cloud compilation.

### Step 3: Compile and Test
Once the maintainer has injected the credentials, you can build the app.
- **To build in the Cloud (EAS):** 
  ```bash
  eas build --profile development --platform ios
  ```
  *(This will generate a `.tar.gz` simulator build you can download).*

- **To build Locally (Requires Xcode):**
  1. Install **Xcode** from the Mac App Store.
  2. Install CocoaPods: `sudo gem install cocoapods`.
  3. Compile and launch Simulator: `npx expo run:ios`.
