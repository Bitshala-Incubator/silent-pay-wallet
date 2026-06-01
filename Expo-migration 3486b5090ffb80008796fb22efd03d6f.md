# Expo-migration

# 🚀 Shroud Wallet - Expo Migration Guide

| Field | Value |
| --- | --- |
| Project | Shroud Wallet (`silent-pay-wallet`) |
| From | Bare React Native 0.78.2 |
| To | Expo SDK 54 + EAS Build + Development Client |
| Created | April 2026 |
| Type | Living document - update as migration progresses |

> 📌 **Strategy:** Shroud Wallet has too many custom native modules to use Expo Managed Workflow. The correct target is **Expo Bare Workflow with a Development Client**, giving you EAS cloud builds without losing any native functionality.
> 

---

# 📋 Table of Contents

1. Why Migrate to Expo
2. Migration Strategy - Which Expo Workflow
3. Compatibility Assessment
4. Package Migration Matrix
5. Pre-Migration Checklist
6. Phase 0 - Preparation
7. Phase 1 - Install Expo Core
8. Phase 2 - Configure app.json & EAS
9. Phase 3 - Replace Packages with Expo Equivalents
10. Phase 4 - Handle Custom Native Modules (Dev Client)
11. Phase 5 - EAS Build Setup
12. Phase 6 - Testing & Validation
13. Known Pitfalls for This Project
14. Post-Migration
15. Reference Links

---

# 1. 🎯 Why Migrate to Expo

## Problems with the Current Bare Setup

| Problem | Impact |
| --- | --- |
| Local iOS/Android SDKs required on every machine | Every contributor needs full Xcode + Android Studio setup |
| Long local build times (15-30 min) | Slows down iteration |
| Inconsistent builds between machines | “Works on my machine” issues |
| Complex CI setup for iOS (macOS runners only) | Expensive and slow |
| Manual code signing | Error-prone, hard to share with new contributors |
| New contributor onboarding takes hours | High barrier to contribution |

## What Expo Gives You

| Benefit | Detail |
| --- | --- |
| **EAS Build** | Cloud builds for iOS and Android - no local SDKs needed |
| **Automated code signing** | EAS handles provisioning profiles and certificates |
| **Faster CI** | No expensive macOS runners needed for most tasks |
| **Consistent builds** | Same output for every team member |
| **OTA updates** | Push JS-only fixes without a full app store release |
| **Dev Client** | Custom development build with all native modules included |

## Expected Outcomes After Migration

- Build time: 15-30 min locally → 5-10 min on EAS cloud
- New contributor setup: 1-2 hours → 15 minutes
- iOS builds: Requires macOS → Works on any OS via EAS
- Code signing: Manual → Automated via EAS

---

# 2. 🏗️ Migration Strategy - Which Expo Workflow

## Why You Cannot Use Managed Workflow

Expo Managed Workflow only works when all your native dependencies are covered by Expo’s SDK or have official Expo plugins. Shroud Wallet has multiple custom native modules with no Expo equivalent:

| Blocker | Reason |
| --- | --- |
| `react-native-blue-crypto` | Custom BlueWallet cryptographic native module |
| `react-native-secure-key-store` | Custom keystore implementation |
| `electrum-client` | Custom TCP socket network layer |
| `react-native-tcp-socket` | Low-level TCP networking |
| `realm` | MongoDB’s native database SDK |
| `react-native-watch-connectivity` | Apple Watch integration |
| All SHA-pinned custom modules | No Expo plugin exists |

## The Right Approach: Bare Workflow + Development Client

```
Bare Workflow = You keep android/ and ios/ directories
Development Client = Custom Expo Go with YOUR native modules
EAS Build = Cloud build service (replaces local compilation)
```

**How it works:**

```
Your Code (JS/TS)
     ↓
app.json + eas.json (Expo config)
     ↓
EAS Build (cloud)
     ↓
Development Client APK/IPA (contains all your native modules)
     ↓
Install once on device → JS updates reload instantly
```

---

# 3. 🔍 Compatibility Assessment

## Packages with Direct Expo Equivalent (Replace)

| Current Package | Replace With | Notes |
| --- | --- | --- |
| `react-native-push-notification` + `@react-native-community/push-notification-ios` | `expo-notifications` | Actively maintained, Android 13+ and iOS 16+ support |
| `react-native-fs` | `expo-file-system` | Full API replacement |
| `react-native-image-picker` | `expo-image-picker` | Drop-in replacement |
| `react-native-permissions` | `expo-modules-core` + individual module permissions | Handled by each Expo module |
| `react-native-device-info` | `expo-device` + `expo-application` | Split across two packages |
| `react-native-localize` | `expo-localization` | Full replacement |
| `react-native-haptic-feedback` | `expo-haptics` | Drop-in replacement |
| `react-native-linear-gradient` | `expo-linear-gradient` | Drop-in replacement |
| `react-native-vector-icons` | `@expo/vector-icons` | Same icons, Expo-managed |
| `@react-native-clipboard/clipboard` | `expo-clipboard` | Drop-in replacement |
| `@react-native-documents/picker` | `expo-document-picker` | Drop-in replacement |
| `react-native-camera-kit` (QR only) | `expo-camera` (with barcode scanner) | If only used for QR scanning |

## Packages That Work with Expo As-Is (Keep)

| Package | Status |
| --- | --- |
| `react-native-reanimated` | ✅ Expo compatible |
| `react-native-gesture-handler` | ✅ Expo compatible |
| `@react-navigation/*` | ✅ Expo compatible |
| `react-native-screens` | ✅ Expo compatible |
| `react-native-safe-area-context` | ✅ Expo compatible |
| `react-native-svg` | ✅ Expo compatible |
| `react-native-qrcode-svg` | ✅ Expo compatible |
| `@react-native-async-storage/async-storage` | ✅ Expo compatible |
| `react-native-keychain` | ✅ Works via dev client |
| `react-native-biometrics` | ✅ Works via dev client |
| `lottie-react-native` | ✅ Works via dev client |
| `react-native-share` | ✅ Works via dev client |
| `react-native-watch-connectivity` | ✅ Works via dev client |
| `@bugsnag/react-native` | ✅ Has Expo plugin |
| All Bitcoin/crypto JS packages | ✅ Pure JS - no native changes needed |

## Packages That Require Development Client (Keep with Dev Client)

| Package | Why | Risk |
| --- | --- | --- |
| `realm` | MongoDB native SDK | Medium - test thoroughly |
| `react-native-keychain` | Native keystore access | Low |
| `react-native-tcp-socket` | Native TCP networking | Medium - Electrum depends on this |
| `electrum-client` (GitHub SHA) | Custom native network layer | High - test all wallet connectivity |
| `react-native-blue-crypto` (GitHub SHA) | Custom native crypto | High - never update without review |
| `react-native-secure-key-store` (GitHub SHA) | Custom keystore | High - security-critical |
| `react-native-camera-kit` | Native camera | Low if only for QR |
| `react-native-watch-connectivity` | Apple Watch native | Low |
| `@lodev09/react-native-true-sheet` | Native bottom sheet | Low |
| `@react-native-menu/menu` | Native context menu | Low |
| `react-native-capture-protection` (GitHub SHA) | Screenshot protection | Medium |
| `react-native-handoff` (GitHub SHA) | iOS Handoff | Low |

## Packages to Remove

| Package | Reason |
| --- | --- |
| `react-native-push-notification` | Replaced by `expo-notifications` |
| `@react-native-community/push-notification-ios` | Replaced by `expo-notifications` |

---

# 4. 📊 Package Migration Matrix

Full command reference for every package change:

## Remove These

```bash
npm uninstall react-native-push-notification
npm uninstall @react-native-community/push-notification-ios
npm uninstall react-native-fs
npm uninstall react-native-image-picker
npm uninstall react-native-permissions
npm uninstall react-native-device-info
npm uninstall react-native-localize
npm uninstall react-native-haptic-feedback
npm uninstall react-native-linear-gradient
npm uninstall react-native-vector-icons
npm uninstall @react-native-clipboard/clipboard
npm uninstall @react-native-documents/picker
```

## Add These

```bash
npx expo install expo-notifications
npx expo install expo-file-system
npx expo install expo-image-picker
npx expo install expo-device expo-application
npx expo install expo-localization
npx expo install expo-haptics
npx expo install expo-linear-gradient
npx expo install @expo/vector-icons
npx expo install expo-clipboard
npx expo install expo-document-picker
npx expo install expo-dev-client
npx expo install expo-modules-core
```

> ⚠️ Always use `npx expo install` instead of `npm install` for Expo packages. It picks the version compatible with your SDK automatically.
> 

## Import Changes Reference

### Push Notifications

```tsx
// BEFORE
import PushNotification from 'react-native-push-notification';
PushNotification.localNotification({ title: 'Hello', message: 'World' });

// AFTER
import * as Notifications from 'expo-notifications';
await Notifications.scheduleNotificationAsync({
  content: { title: 'Hello', body: 'World' },
  trigger: null,
});
```

### File System

```tsx
// BEFORE
import RNFS from 'react-native-fs';
const content = await RNFS.readFile(RNFS.DocumentDirectoryPath + '/wallet.json');

// AFTER
import * as FileSystem from 'expo-file-system';
const content = await FileSystem.readAsStringAsync(
  FileSystem.documentDirectory + 'wallet.json'
);
```

### Image Picker

```tsx
// BEFORE
import ImagePicker from 'react-native-image-picker';
ImagePicker.launchImageLibrary({}, response => { ... });

// AFTER
import * as ImagePicker from 'expo-image-picker';
const result = await ImagePicker.launchImageLibraryAsync({ ... });
```

### Clipboard

```tsx
// BEFORE
import Clipboard from '@react-native-clipboard/clipboard';
Clipboard.setString('text');

// AFTER
import * as Clipboard from 'expo-clipboard';
await Clipboard.setStringAsync('text');
```

### Haptics

```tsx
// BEFORE
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
ReactNativeHapticFeedback.trigger('impactMedium');

// AFTER
import * as Haptics from 'expo-haptics';
await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
```

### Linear Gradient

```tsx
// BEFORE
import LinearGradient from 'react-native-linear-gradient';

// AFTER
import { LinearGradient } from 'expo-linear-gradient';
// Props are identical
```

### Vector Icons

```tsx
// BEFORE
import Icon from 'react-native-vector-icons/MaterialIcons';

// AFTER
import { MaterialIcons as Icon } from '@expo/vector-icons';
// Usage is identical
```

### Localization

```tsx
// BEFORE
import RNLocalize from 'react-native-localize';
const locale = RNLocalize.getLocales()[0].languageCode;

// AFTER
import * as Localization from 'expo-localization';
const locale = Localization.getLocales()[0].languageCode;
```

### Device Info

```tsx
// BEFORE
import DeviceInfo from 'react-native-device-info';
const model = DeviceInfo.getModel();
const version = DeviceInfo.getSystemVersion();

// AFTER
import * as Device from 'expo-device';
import * as Application from 'expo-application';
const model = Device.modelName;
const version = Device.osVersion;
```

---

# 5. ✅ Pre-Migration Checklist

## Before Starting

- [ ]  All current tests pass (`npm run test`)
- [ ]  Project builds successfully on Android and iOS
- [ ]  Current state is committed and pushed to a branch
- [ ]  Create migration branch: `git checkout -b migrate/expo-sdk54`
- [ ]  Node.js ≥ 20 installed
- [ ]  EAS CLI installed: `npm install -g eas-cli`
- [ ]  Logged into Expo account: `eas login`
- [ ]  Expo account has an active project (free tier works)

## Team Coordination

- [ ]  Notify all contributors - builds will change
- [ ]  Decide who manages EAS credentials (team owner)
- [ ]  Set up the Expo organization account if using Team Builds
- [ ]  Agree on which EAS build profile each person uses

---

# 6. 🔧 Phase 0 - Preparation *(1 day)*

```bash
# Create migration branch
git checkout -b migrate/expo-sdk54

# Establish test baseline
npm run test

# Fix known issue: move detox to devDependencies
npm uninstall detox
npm install --save-dev detox@20.40.2

# Audit current package state
npm outdated

# Commit clean state
git add -A && git commit -m "chore: pre-expo-migration baseline"
```

---

# 7. 📦 Phase 1 - Install Expo Core *(half day)*

```bash
# Install Expo SDK 54
npm install expo@54

# Install Expo modules core (required for all expo-* packages)
npx expo install expo-modules-core

# Install the development client (required for custom native modules)
npx expo install expo-dev-client

# Run Expo's doctor to check compatibility
npx expo-doctor
```

## Update index.js

```jsx
// BEFORE
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);

// AFTER
import 'expo-dev-client';   // ADD THIS LINE FIRST
import {AppRegistry} from 'react-native';
import App from './App';
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

## Update babel.config.js

```jsx
// BEFORE
module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: ['react-native-reanimated/plugin'],
};

// AFTER
module.exports = {
  presets: ['babel-preset-expo'],
  plugins: ['react-native-reanimated/plugin'],
};
```

```bash
npm install --save-dev babel-preset-expo
```

---

# 8. ⚙️ Phase 2 - Configure app.json & EAS *(half day)*

## Create app.json

Create `app.json` at the project root:

```json
{
  "expo": {
    "name": "Shroud Wallet",
    "slug": "shroud-wallet",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./img/icon.png",
    "userInterfaceStyle": "automatic",
    "splash": {
      "resizeMode": "contain",
      "backgroundColor": "#000000"
    },
    "ios": {
      "supportsTabletMode": false,
      "bundleIdentifier": "com.bitshala.shroudwallet",
      "deploymentTarget": "16.0",
      "infoPlist": {
        "NSCameraUsageDescription": "Shroud Wallet uses the camera to scan QR codes",
        "NSFaceIDUsageDescription": "Shroud Wallet uses Face ID to unlock your wallet",
        "NSPhotoLibraryUsageDescription": "Shroud Wallet needs access to photos to import wallet backups"
      }
    },
    "android": {
      "package": "com.bitshala.shroudwallet",
      "adaptiveIcon": {
        "foregroundImage": "./img/icon.png",
        "backgroundColor": "#000000"
      },
      "permissions": [
        "CAMERA",
        "USE_BIOMETRIC",
        "USE_FINGERPRINT",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE"
      ]
    },
    "plugins": [
      "expo-dev-client",
      [
        "@bugsnag/react-native",
        {
          "apiKey": "YOUR_BUGSNAG_API_KEY"
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./img/notification-icon.png",
          "color": "#000000"
        }
      ],
      "expo-localization"
    ],
    "extra": {
      "eas": {
        "projectId": "YOUR_EAS_PROJECT_ID"
      }
    }
  }
}
```

## Create eas.json

```json
{
  "cli": {
    "version": ">= 7.0.0"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      },
      "ios": {
        "simulator": true
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      },
      "ios": {
        "simulator": false
      }
    },
    "production": {
      "android": {
        "buildType": "aab"
      },
      "ios": {
        "simulator": false
      }
    }
  },
  "submit": {
    "production": {
      "android": {
        "serviceAccountKeyPath": "./google-service-account.json",
        "track": "internal"
      },
      "ios": {
        "appleId": "YOUR_APPLE_ID",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID"
      }
    }
  }
}
```

## Initialise EAS Project

```bash
eas init
eas build:configure
```

---

# 9. 🔄 Phase 3 - Replace Packages with Expo Equivalents *(3-5 days)*

Work through each package replacement one by one. Do not replace multiple packages in a single commit - this makes debugging much easier.

## Step 1 - Notifications

```bash
npm uninstall react-native-push-notification @react-native-community/push-notification-ios
npx expo install expo-notifications
```

Search and replace all imports:

```bash
# Find all files using the old packages
grep -r "react-native-push-notification" screen/ components/ blue_modules/ --include="*.ts" --include="*.tsx" --include="*.js"
```

Update each file using the import reference in Section 4.

```bash
npm run unit && npm run integration
git commit -m "feat: migrate push notifications to expo-notifications"
```

## Step 2 - File System

```bash
npm uninstall react-native-fs
npx expo install expo-file-system
```

```bash
grep -r "react-native-fs" screen/ components/ blue_modules/ class/ --include="*.ts" --include="*.tsx" --include="*.js"
```

Update imports using the reference in Section 4. Note: file paths differ - `RNFS.DocumentDirectoryPath` becomes `FileSystem.documentDirectory`.

```bash
npm run unit && npm run integration
git commit -m "feat: migrate file system to expo-file-system"
```

## Step 3 - Image Picker, Clipboard, Document Picker

```bash
npm uninstall react-native-image-picker @react-native-clipboard/clipboard @react-native-documents/picker
npx expo install expo-image-picker expo-clipboard expo-document-picker
```

Update each import per Section 4, test, commit separately.

## Step 4 - UI Replacements

```bash
npm uninstall react-native-haptic-feedback react-native-linear-gradient react-native-vector-icons react-native-localize
npx expo install expo-haptics expo-linear-gradient @expo/vector-icons expo-localization
```

> ⚠️ **Vector Icons Warning:** After switching to `@expo/vector-icons`, search the entire codebase for `react-native-vector-icons` imports. The import path changes from named default imports to named exports.
> 

## Step 5 - Device Info

```bash
npm uninstall react-native-device-info
npx expo install expo-device expo-application
```

Note: `DeviceInfo.getModel()` → `Device.modelName`, `DeviceInfo.getSystemVersion()` → `Device.osVersion`. Not all DeviceInfo APIs have direct equivalents - audit each usage.

---

# 10. 🔌 Phase 4 - Handle Custom Native Modules *(1-2 weeks)*

These packages stay but need to be verified in the Expo Development Client context.

## The Development Client Build Process

```bash
# Build development client for Android (APK)
eas build --profile development --platform android

# Build development client for iOS
eas build --profile development --platform ios

# Install on device, then start Metro:
npx expo start --dev-client
```

## Packages to Verify One by One

### Realm (Database)

Realm works with Expo via dev client but requires careful setup:

```bash
# Verify realm is still working after migration
npm run unit   # Runs realm-dependent unit tests
npm run integration
```

If Realm fails to link, add to `app.json` plugins:

```json
"plugins": [
  ["realm", { "enableFlipperPlugin": false }]
]
```

### react-native-tcp-socket + electrum-client

This is the most critical path - all wallet network functionality depends on it:

```bash
# After building dev client, test connectivity to an Electrum server
# Run integration tests that hit the network layer
npm run integration
```

### react-native-blue-crypto

Custom cryptographic native module. Key operations to test:

1. Wallet creation (key derivation)
2. Transaction signing
3. Silent Payment address generation
4. Entropy generation

### react-native-secure-key-store

Test all wallet unlock / PIN entry flows after building dev client.

### react-native-biometrics + react-native-keychain

Test biometric unlock flows on a real device (simulators don’t support biometrics fully).

---

# 11. ☁️ Phase 5 - EAS Build Setup *(1 day)*

## Set Up Credentials

```bash
# Android keystore (EAS manages this for you)
eas credentials --platform android

# iOS provisioning (EAS manages this for you)
eas credentials --platform ios
```

## Build and Test Each Profile

```bash
# Development build (contains dev client)
eas build --profile development --platform android
eas build --profile development --platform ios

# Preview build (internal distribution, no dev client)
eas build --profile preview --platform android

# Production build (App Store / Play Store)
eas build --profile production --platform android
eas build --profile production --platform ios
```

## Update CircleCI to Use EAS

Replace your existing build steps with:

```yaml
# .circleci/config.yml
-run:
name: Build Android (EAS)
command: eas build --profile preview --platform android --non-interactive

-run:
name: Build iOS (EAS)
command: eas build --profile preview --platform ios --non-interactive
```

Install EAS CLI in CI:

```yaml
-run:
name: Install EAS CLI
command: npm install -g eas-cli
-run:
name: EAS Login
command: eas login --token $EXPO_TOKEN
```

Set `EXPO_TOKEN` as a CircleCI environment variable from your Expo account settings.

---

# 12. 🧪 Phase 6 - Testing & Validation *(3-5 days)*

## Test Matrix

| Test Type | Command | When |
| --- | --- | --- |
| Unit tests | `npm run unit` | After every package replacement |
| Integration tests | `npm run integration` | After every package replacement |
| TypeScript | `npm run tslint` | After every package replacement |
| Dev client build | `eas build --profile development` | After Phase 4 |
| Bitcoin operations | Manual | After native modules verified |
| Biometrics | Manual on device | After Phase 4 |
| Notifications | Manual on device | After Phase 3 Step 1 |
| E2E | `npm run e2e:debug` | End of Phase 6 |

## Critical Bitcoin Functionality Checklist

- [ ]  Create a new wallet (key generation works)
- [ ]  Restore wallet from mnemonic (BIP-39 derivation works)
- [ ]  Receive a Bitcoin address (address derivation correct)
- [ ]  Generate a Silent Payment address (@silent-pay/core works)
- [ ]  Scan a QR code payment address (camera-kit / expo-camera works)
- [ ]  Sign a transaction (react-native-blue-crypto works)
- [ ]  Broadcast a transaction (electrum-client network works)
- [ ]  Biometric unlock (react-native-biometrics works)
- [ ]  Push notification received (expo-notifications works)
- [ ]  Wallet data persists across app restarts (Realm works)
- [ ]  File export/import (expo-file-system works)

---

# 13. ⚠️ Known Pitfalls for This Project

## Pitfall 1 - Metro Config Needs Update

After adding Expo, update `metro.config.js`:

```jsx
// BEFORE
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

// AFTER
const { getDefaultConfig } = require('expo/metro-config');
const { mergeConfig } = require('@react-native/metro-config');
```

The resolver for `stream`, `crypto`, `net`, `tls` must be kept:

```jsx
const config = {
  resolver: {
    extraNodeModules: {
      stream: require.resolve('stream-browserify'),
      crypto: require.resolve('crypto-browserify'),
      net: require.resolve('react-native-tcp-socket'),
      tls: require.resolve('react-native-tcp-socket'),
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

---

## Pitfall 2 - Realm + Expo Prebuild

If you run `npx expo prebuild`, it regenerates `android/` and `ios/` from `app.json`. This will **overwrite** manual changes you’ve made to native files.

**Solution:** Use Expo config plugins for any native modifications, and only run prebuild intentionally.

---

## Pitfall 3 - react-native-blue-crypto in Expo Context

This is a GitHub SHA-pinned custom native module from BlueWallet. It has no Expo plugin. It must be kept in the native directories manually.

After any `npx expo prebuild --clean`, re-verify that the native module is still linked correctly:

```bash
# Android: check settings.gradle and app/build.gradle still reference it
# iOS: check Podfile still references it
```

---

## Pitfall 4 - `@noble/secp256k1` v1 vs v2 in Expo Metro

Expo’s Metro bundler should resolve this correctly, but if you see errors about secp256k1:

```jsx
// In metro.config.js, add explicit resolution:
resolver: {
  extraNodeModules: {
    ...
    // Force secp256k1 v1 (not v2 which has different API)
  }
}
```

---

## Pitfall 5 - Bitcoin JS Polyfills Must Load First

The `shim.js` file loads polyfills for `Buffer`, `crypto`, and `URL`. In Expo, ensure this still loads before any Bitcoin library.

In `index.js`:

```jsx
import 'expo-dev-client';
import './shim';    // MUST be before any Bitcoin imports
import {AppRegistry} from 'react-native';
import App from './App';
...
```

---

## Pitfall 6 - iOS Simulator vs Real Device

`react-native-blue-crypto` may behave differently on simulators due to architecture differences (x86_64 vs arm64). Always test cryptographic operations on a real device before releasing.

---

## Pitfall 7 - EAS Build Cache

EAS caches npm packages and native builds. After changing any SHA-pinned package, clear the EAS cache:

```bash
eas build --profile development --platform android --clear-cache
```

---

# 14. 🏁 Post-Migration

## Update .gitignore

After migration, add Expo-specific entries:

```
# Expo
.expo/
.expo-shared/
dist/

# EAS
eas-build-on-simulator.log
```

Keep `android/` and `ios/` in version control (you are in bare workflow, not managed).

## Update README.md

Replace current build instructions with:

```markdown
## Development Setup

1.Install EAS CLI: `npm install -g eas-cli`
2.Login: `eas login`
3.Install dependencies: `npm install`
4.Build dev client: `eas build --profile development --platform android`
5.Install dev client APK on device/emulator
6.Start Metro: `npx expo start --dev-client`
```

## OTA Updates (Optional Post-Migration)

Once stable, you can use EAS Update to push JS-only changes without a full app store release:

```bash
eas update --branch production --message "Fix transaction display bug"
```

---

# 15. 🔗 Reference Links

## Expo Documentation

- [Expo SDK 54 Changelog](https://expo.dev/changelog/sdk-54)
- [Expo Bare Workflow](https://docs.expo.dev/bare/overview/)
- [Development Client Setup](https://docs.expo.dev/develop/development-builds/create-a-build/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Update (OTA)](https://docs.expo.dev/eas-update/introduction/)
- [app.json Configuration](https://docs.expo.dev/versions/latest/config/app/)
- [eas.json Configuration](https://docs.expo.dev/build/eas-json/)
- [Expo Config Plugins](https://docs.expo.dev/config-plugins/introduction/)

## Package Migration References

- [expo-notifications](https://docs.expo.dev/versions/latest/sdk/notifications/)
- [expo-file-system](https://docs.expo.dev/versions/latest/sdk/filesystem/)
- [expo-image-picker](https://docs.expo.dev/versions/latest/sdk/imagepicker/)
- [expo-device](https://docs.expo.dev/versions/latest/sdk/device/)
- [expo-localization](https://docs.expo.dev/versions/latest/sdk/localization/)
- [expo-haptics](https://docs.expo.dev/versions/latest/sdk/haptics/)
- [expo-linear-gradient](https://docs.expo.dev/versions/latest/sdk/linear-gradient/)
- [@expo/vector-icons](https://docs.expo.dev/guides/icons/)
- [expo-clipboard](https://docs.expo.dev/versions/latest/sdk/clipboard/)

## This Project

- [BlueWallet (upstream - reference for SHA-pinned packages)](https://github.com/BlueWallet/BlueWallet)
- [silent-pay core library](https://github.com/Bitshala-Incubator/silent-pay)
- [BIP-352: Silent Payments](https://github.com/bitcoin/bips/blob/master/bip-0352.mediawiki)
- [React Native Upgrade Helper](https://react-native-community.github.io/upgrade-helper/)

---

*Update this document as you progress through each phase. Mark phases complete and note any deviations from the plan.*