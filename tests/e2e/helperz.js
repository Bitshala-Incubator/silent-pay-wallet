import { sha256 } from '@noble/hashes/sha256';
import { element } from 'detox';

export async function waitForId(id, timeout = 33000) {
  try {
    await waitFor(element(by.id(id)))
      .toBeVisible()
      .withTimeout(timeout / 2);
  } catch (_) {
    // nop
  }

  try {
    await waitFor(element(by.id(id)))
      .toBeVisible()
      .withTimeout(timeout / 2);
    return true;
  } catch (_) {
    const msg = `Assertion failed: testID ${id} is not visible`;
    throw new Error(msg);
  }
}

export async function waitForText(text, timeout = 33000) {
  try {
    await waitFor(element(by.text(text)))
      .toBeVisible()
      .withTimeout(timeout / 2);
    return true;
  } catch (_) {
    // nop
  }

  try {
    await waitFor(element(by.text(text)))
      .toBeVisible()
      .withTimeout(timeout / 2);
    return true;
  } catch (_) {
    const msg = `Assertion failed: text "${text}" is not visible`;
    throw new Error(msg);
  }
}

export async function getSwitchValue(switchId) {
  try {
    await expect(element(by.id(switchId))).toHaveToggleValue(true);
    return true;
  } catch (_) {
    return false;
  }
}

export async function helperImportWallet(importText, walletType, passphrase) {
  await waitForId('ImportWallet');
  await device.disableSynchronization();

  try {
    await element(by.id('ImportWallet')).tap();
    for (let c = 0; c < 5; c++) {
      await element(by.id('SpeedBackdoor')).tap();
      await sleep(1000);
    }
    await element(by.id('SpeedMnemonicInput')).replaceText(importText);
    await element(by.id('SpeedWalletTypeInput')).replaceText(walletType);
    if (passphrase) await element(by.id('SpeedPassphraseInput')).replaceText(passphrase);
    await element(by.id('SpeedDoImport')).tap();
    await waitForId('WalletsList', 3 * 61000);
  } finally {
    await device.enableSynchronization();
  }
}

export async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function hashIt(s) {
  return Buffer.from(sha256(s)).toString('hex');
}

export async function helperDeleteWallet() {
  await element(by.id('SettingsButton')).tap();
  await element(by.id('DeleteWalletButton')).tap();
  await waitForText('Yes, delete');
  await element(by.text('Yes, delete')).tap();
  await waitForId('CreateWallet'); // after deletion, returns to onboarding
}

/*

module.exports.helperImportWallet = helperImportWallet;
module.exports.waitForId = waitForId;
module.exports.waitForText = waitForText;
module.exports.sleep = sleep;
module.exports.hashIt = hashIt;
module.exports.helperDeleteWallet = helperDeleteWallet;

*/

/**
 * a hack to extract element text. warning, this might break in future
 * @see https://github.com/wix/detox/issues/445
 *
 * @returns {Promise<string>}
 */
export async function extractTextFromElementById(id) {
  try {
    await expect(element(by.id(id))).toHaveText('_unfoundable_text');
  } catch (error) {
    if (device.getPlatform() === 'ios') {
      const start = `accessibilityLabel was "`;
      const end = '" on ';
      const errorMessage = error.message.toString();
      const [, restMessage] = errorMessage.split(start);
      const [label] = restMessage.split(end);
      return label;
    } else {
      const start = 'Got:';
      const end = '}"';
      const errorMessage = error.message.toString();
      const [, restMessage] = errorMessage.split(start);
      const [label] = restMessage.split(end);
      const value = label.split(',');
      const combineText = value.find(i => i.includes('text=')).trim();
      const [, elementText] = combineText.split('=');
      return elementText;
    }
  }
}

export const expectToBeVisible = async id => {
  try {
    await expect(element(by.id(id))).toBeVisible();
    return true;
  } catch (e) {
    return false;
  }
};

export async function helperCreateWallet() {
  await waitForId('CreateWallet');
  await device.disableSynchronization();
  try {
    await element(by.id('CreateWallet')).tap();
    await waitForId('PleaseBackupScrollView', 120000);
    for (let c = 0; c < 5; c++) {
      await element(by.id('SkipVerifyBackdoor')).tap();
      await sleep(500);
    }
    await waitForId('WalletsList');
  } finally {
    await device.enableSynchronization();
  }
}

export async function tapAndTapAgainIfElementIsNotVisible(idToTap, idToCheckVisible) {
  // tap
  await element(by.id(idToTap)).tap();

  // check if visible
  try {
    await waitFor(element(by.id(idToCheckVisible)))
      .toBeVisible()
      .withTimeout(3_000);
    return; // did not throw? its visible, return
  } catch (_) {}

  // did not return so its not visible, lets tap again
  await element(by.id(idToTap)).tap();

  // check visibility again, this time no try-catch, if it fails it fails
  await waitFor(element(by.id(idToCheckVisible)))
    .toBeVisible()
    .withTimeout(3_000);
}

export async function tapAndTapAgainIfTextIsNotVisible(textToTap, textToCheckVisible) {
  // tap
  await element(by.text(textToTap)).tap();

  // check if visible
  try {
    await waitFor(element(by.text(textToCheckVisible)))
      .toBeVisible()
      .withTimeout(3_000);
    return; // did not throw? its visible, return
  } catch (_) {}

  // did not return so its not visible, lets tap again
  await element(by.text(textToTap)).tap();

  // check visibility again, this time no try-catch, if it fails it fails
  await waitFor(element(by.text(textToCheckVisible)))
    .toBeVisible()
    .withTimeout(3_000);
}

export async function tapIfPresent(id) {
  try {
    await element(by.id(id)).tap();
  } catch (_) {}
  // no need to check for visibility, just silently ignore exception if such testID is not present
}

export async function tapIfTextPresent(text) {
  try {
    await element(by.text(text)).tap();
  } catch (_) {}
  // no need to check for visibility, just silently ignore exception if such testID is not present
}

export async function countElements(testId) {
  let count = 0;
  while (true) {
    try {
      await expect(element(by.id(testId)).atIndex(count)).toExist();
      count++;
    } catch (_) {
      break;
    }
  }
  return count;
}

export async function scanText(text) {
  await sleep(5000); // wait for camera screen to initialize
  await waitForId('ScanQrBackdoorButton');
  for (let c = 0; c <= 5; c++) {
    await element(by.id('ScanQrBackdoorButton')).tap();
  }
  await element(by.id('scanQrBackdoorInput')).replaceText(text);
  await element(by.id('scanQrBackdoorOkButton')).tap();
}
