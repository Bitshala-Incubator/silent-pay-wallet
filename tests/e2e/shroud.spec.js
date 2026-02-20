import {
  expectToBeVisible,
  hashIt,
  helperCreateWallet,
  helperDeleteWallet,
  sleep,
  waitForText,
  tapAndTapAgainIfElementIsNotVisible,
  tapIfPresent,
  waitForId,
} from './helperz';
import { element } from 'detox';

// if loglevel is set to `error`, this kind of logging will still get through
console.warn = console.log = (...args) => {
  let output = '';
  args.map(arg => (output += String(arg)));

  process.stdout.write('\n\t\t' + output + '\n');
};

/**
 * this testsuite is for test cases that require no wallets to be present
 */
describe('Shroud UI Tests - no wallets', () => {
  it.skip('selftest passes', async () => {
    const lockFile = '/tmp/travislock.' + hashIt('t1');
    if (process.env.TRAVIS) {
      if (require('fs').existsSync(lockFile)) return console.warn('skipping', JSON.stringify('t1'), 'as it previously passed on Travis');
    }
    await device.launchApp({ delete: true }); // reinstalling the app just for any case to clean up app's storage
    await helperCreateWallet();

    // go to settings, press SelfTest and wait for OK
    await element(by.id('SettingsButton')).tap();
    await element(by.id('AboutButton')).tap();
    await element(by.id('AboutScrollView')).swipe('up', 'fast', 1); // in case emu screen is small and it doesnt fit
    await tapAndTapAgainIfElementIsNotVisible('RunSelfTestButton', 'SelfTestLoading');
    await waitFor(element(by.id('SelfTestOk')))
      .toBeVisible()
      .withTimeout(300 * 1000);
    await device.pressBack();
    await device.pressBack();
    await device.pressBack();
    process.env.TRAVIS && require('fs').writeFileSync(lockFile, '1');
  });

  it('all settings screens work', async () => {
    const lockFile = '/tmp/travislock.' + hashIt('t2');
    if (process.env.TRAVIS) {
      if (require('fs').existsSync(lockFile)) return console.warn('skipping', JSON.stringify('t2'), 'as it previously passed on Travis');
    }
    await device.launchApp({ delete: true }); // reinstalling the app just for any case to clean up app's storage
    await helperCreateWallet();

    // go to settings, press SelfTest and wait for OK
    await element(by.id('SettingsButton')).tap();

    // general
    // await element(by.id('GeneralSettings')).tap();

    // privacy
    // trigger switches
    // await element(by.id('SettingsPrivacy')).tap();
    // await element(by.id('ClipboardSwitch')).tap();
    // await element(by.id('ClipboardSwitch')).tap();
    // await element(by.id('QuickActionsSwitch')).tap();
    // await element(by.id('QuickActionsSwitch')).tap();
    // await device.pressBack();
    // await device.pressBack();

    // currency
    // change currency to ARS ($) and switch it back to USD ($)
    await element(by.id('Currency')).tap();
    await element(by.text('ARS ($)')).tap();
    await expect(element(by.text('Rate is obtained from Yadio'))).toBeVisible();
    await element(by.text('USD ($)')).tap();
    await device.pressBack();

    // language
    // change language to Chinese (ZH), test it and switch back to English
    await element(by.id('Language')).tap();
    await element(by.text('Chinese (ZH)')).tap();
    await device.pressBack();
    await expect(element(by.text('语言'))).toBeVisible();
    await element(by.id('Language')).tap();
    await element(by.text('English')).tap();
    await device.pressBack();

    // security
    // await element(by.id('SecurityButton')).tap();
    // await device.pressBack();

    // network
    // await element(by.id('NetworkSettings')).tap();

    // network -> electrum server
    // just verify navigation works (save/restore skipped — electrum server unreachable from emulator)
    // await element(by.id('ElectrumSettings')).tap();
    // await waitForId('ElectrumSettingsScrollView');
    // await device.pressBack();

    // network -> lightning
    // change URI and revert it back
    /* muted since https://lndhub.herokuapp.com is down
    await element(by.id('LightningSettings')).tap();
    await element(by.id('URIInput')).replaceText('invalid\n');
    await element(by.id('Save')).tap();
    await waitForText('OK');
    await expect(element(by.text('Invalid LNDHub URI'))).toBeVisible();
    await element(by.text('OK')).tap();
    await element(by.id('URIInput')).replaceText('https://lndhub.herokuapp.com\n');
    await element(by.id('Save')).tap();
    await waitForText('OK');
    await expect(element(by.text('Your changes have been saved successfully.'))).toBeVisible();
    await element(by.text('OK')).tap();
    await element(by.id('URIInput')).replaceText('\n');
    await element(by.id('Save')).tap();
    await waitForText('OK');
    await expect(element(by.text('Your changes have been saved successfully.'))).toBeVisible();
    await element(by.text('OK')).tap();
    await device.pressBack();
    */

    // notifications
    // turn on notifications if available
    // console.warn('waitForId');
    // await sleep(300000);
    // if (await expectToBeVisible('NotificationSettings')) {
    //   await element(by.id('NotificationSettings')).tap();
    //   await element(by.id('NotificationsSwitch')).tap();
    //   await sleep(3_000);
    //   await element(by.id('NotificationsSwitch')).tap();
    //   await device.pressBack();
    //   await device.pressBack();
    // } else {
    //   await device.pressBack();
    // }

    // tools
    // await element(by.id('Tools')).tap();

    // tools -> broadcast
    // try to broadcast wrong tx
    // await element(by.id('Broadcast')).tap();
    // await element(by.id('TxHex')).replaceText('invalid\n');
    // await element(by.id('BroadcastButton')).tap();
    // await waitForText('OK');
    // await expect(element(by.text('the transaction was rejected by network rules....'))).toBeVisible();
    // await element(by.text('OK')).tap();
    // await device.pressBack();

    // IsItMyAddress
    // await element(by.id('IsItMyAddress')).tap();
    // await element(by.id('AddressInput')).replaceText('bc1q063ctu6jhe5k4v8ka99qac8rcm2tzjjnuktyrl');
    // await element(by.id('CheckAddress')).tap();
    // await expect(element(by.text('None of the available wallets own the provided address.'))).toBeVisible();
    // await element(by.text('OK')).tap();
    // await device.pressBack();
    // await device.pressBack();

    // about
    await element(by.id('AboutButton')).tap();
    await device.pressBack();
    await device.pressBack();
    process.env.TRAVIS && require('fs').writeFileSync(lockFile, '1');
  });

  it('can create wallet, reload app and it persists. then go to receive screen, set custom amount and label. Dismiss modal and go to WalletsList.', async () => {
    const lockFile = '/tmp/travislock.' + hashIt('t3');
    if (process.env.TRAVIS) {
      if (require('fs').existsSync(lockFile)) return console.warn('skipping', JSON.stringify('t3'), 'as it previously passed on Travis');
    }
    await device.launchApp({ delete: true }); // reinstalling the app just for any case to clean up app's storage
    await helperCreateWallet();

    await device.launchApp({ newInstance: true });
    await device.disableSynchronization();
    try {
      await waitForId('WalletsList');
      await expect(element(by.id('Wallet'))).toBeVisible();
      await sleep(3000); // wait for float buttons animation
      await element(by.id('HomeScreenReceiveButton')).tap();
      await waitForText('Yes, I have.');
      await element(by.text('Yes, I have.')).tap();
      await sleep(5000); // wait for receive screen to load
      try {
        // in case emulator has no google services and doesnt support pushes
        // we just dont show this popup
        await element(by.text(`No, and do not ask me again.`)).tap();
        await element(by.text(`No, and do not ask me again.`)).tap(); // sometimes the first click doesnt work (detox issue, not app's)
      } catch (_) {}
      await waitForId('ReceiveDetailsScrollView');
      await waitForId('CopyTextToClipboard');
    } finally {
      await device.enableSynchronization();
    }

    process.env.TRAVIS && require('fs').writeFileSync(lockFile, '1');
  });

  it.skip('can encrypt storage, with plausible deniability; decrypt fake storage', async () => {
    const lockFile = '/tmp/travislock.' + hashIt('t4');
    if (process.env.TRAVIS) {
      if (require('fs').existsSync(lockFile)) return console.warn('skipping', JSON.stringify('t4'), 'as it previously passed on Travis');
    }
    await device.launchApp({ delete: true }); // reinstalling the app just for any case to clean up app's storage
    await waitForId('WalletsList');

    // lets create a wallet
    await helperCreateWallet();

    // go to settings
    await expect(element(by.id('SettingsButton'))).toBeVisible();
    await element(by.id('SettingsButton')).tap();
    await expect(element(by.id('SecurityButton'))).toBeVisible();

    // go to Security page where we will enable encryption
    await element(by.id('SecurityButton')).tap();
    // await expect(element(by.id('EncyptedAndPasswordProtected'))).toBeVisible(); // @see https://github.com/@rneui/themed/@rneui/themed/issues/2519
    await expect(element(by.id('PlausibleDeniabilityButton'))).toBeNotVisible();

    if (device.getPlatform() === 'ios') {
      console.warn('Android only test skipped');
      return;
    }

    // lets encrypt the storage.
    // first, trying to mistype second password:
    await element(by.id('EncyptedAndPasswordProtectedSwitch')).tap();
    await element(by.id('IUnderstandButton')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash

    await element(by.id('PasswordInput')).replaceText('08902');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).replaceText('666');
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash

    // now, lets put correct passwords and encrypt the storage
    await element(by.id('PasswordInput')).clearText();
    await element(by.id('PasswordInput')).replaceText('qqq');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).clearText();
    await element(by.id('ConfirmPasswordInput')).replaceText('qqq');
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // might not always work the first time
    await sleep(3000); // propagate

    // relaunch app
    await device.launchApp({ newInstance: true });

    // trying to decrypt with incorrect password
    await waitForText('Your storage is encrypted. Password is required to decrypt it.');
    await element(by.type('android.widget.EditText')).typeText('wrong');
    await element(by.text('OK')).tap();
    await expect(element(by.text('Incorrect password. Please try again.'))).toBeVisible();

    // correct password
    await element(by.type('android.widget.EditText')).typeText('qqq');
    await element(by.text('OK')).tap();
    await waitForId('WalletsList');

    // previously created wallet should be visible
    await expect(element(by.id('cr34t3d'))).toBeVisible();

    // now lets enable plausible deniability feature

    // go to settings -> security screen -> plausible deniability screen
    await element(by.id('SettingsButton')).tap();
    await expect(element(by.id('SecurityButton'))).toBeVisible();
    await element(by.id('SecurityButton')).tap();
    // await expect(element(by.id('EncyptedAndPasswordProtected'))).toBeVisible(); // @see https://github.com/@rneui/themed/@rneui/themed/issues/2519
    await expect(element(by.id('PlausibleDeniabilityButton'))).toBeVisible();
    await element(by.id('PlausibleDeniabilityButton')).tap();

    // trying to enable plausible denability
    await element(by.id('CreateFakeStorageButton')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash

    // trying MAIN password: should fail, obviously
    await element(by.id('PasswordInput')).replaceText('qqq');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).replaceText('qqq');
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // first time might not always work
    await sleep(3000); // propagate
    await expect(element(by.text('Password is currently in use. Please try a different password.'))).toBeVisible();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash
    await element(by.text('OK')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash

    // trying new password, but will mistype
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash
    await element(by.id('PasswordInput')).clearText();
    await element(by.id('PasswordInput')).replaceText('passwordForFakeStorage');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).clearText();
    await element(by.id('ConfirmPasswordInput')).replaceText('passwordForFakeStorageWithTypo'); // retyping with typo
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash

    // trying new password
    await element(by.id('PasswordInput')).clearText();
    await element(by.id('PasswordInput')).replaceText('passwordForFakeStorage');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).clearText();
    await element(by.id('ConfirmPasswordInput')).replaceText('passwordForFakeStorage'); // retyping
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // first time might not always work
    await sleep(3_000); // propagate

    // created fake storage.
    // creating a wallet inside this fake storage
    await helperCreateWallet();

    // relaunch the app, unlock with fake password, expect to see fake wallet

    // relaunch app
    await device.launchApp({ newInstance: true });
    //
    await waitForText('Your storage is encrypted. Password is required to decrypt it.');
    await element(by.type('android.widget.EditText')).typeText('qqq');
    await element(by.text('OK')).tap();
    await waitForId('WalletsList');

    // previously created wallet IN MAIN STORAGE should be visible
    await expect(element(by.id('cr34t3d'))).toBeVisible();

    // relaunch app
    await device.launchApp({ newInstance: true });
    //
    await waitForText('Your storage is encrypted. Password is required to decrypt it.');
    await element(by.type('android.widget.EditText')).typeText('passwordForFakeStorage');
    await element(by.text('OK')).tap();
    await waitForId('WalletsList');

    // previously created wallet in FAKE storage should be visible
    await expect(element(by.id('fake_wallet'))).toBeVisible();

    // now derypting it, to cleanup
    await element(by.id('SettingsButton')).tap();
    await element(by.id('SecurityButton')).tap();

    // correct password
    await element(by.id('EncyptedAndPasswordProtectedSwitch')).tap();
    await element(by.text('OK')).tap();
    await element(by.id('PasswordInput')).replaceText('passwordForFakeStorage');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // in case it didnt work first time
    await sleep(3000); // propagate
    await expect(element(by.text('fake_wallet'))).toBeVisible();

    process.env.TRAVIS && require('fs').writeFileSync(lockFile, '1');
  });

  it.skip('can encrypt storage, and decrypt storage works', async () => {
    const lockFile = '/tmp/travislock.' + hashIt('t5');
    if (process.env.TRAVIS) {
      if (require('fs').existsSync(lockFile)) return console.warn('skipping', JSON.stringify('t5'), 'as it previously passed on Travis');
    }
    await device.launchApp({ delete: true }); // reinstalling the app just for any case to clean up app's storage
    await helperCreateWallet();
    await element(by.id('SettingsButton')).tap();
    await element(by.id('SecurityButton')).tap();
    if (device.getPlatform() === 'ios') {
      console.warn('Android only test skipped');
      return;
    }

    // lets encrypt the storage.
    // lets put correct passwords and encrypt the storage
    await element(by.id('EncyptedAndPasswordProtectedSwitch')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash
    await element(by.id('IUnderstandButton')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash
    await element(by.id('PasswordInput')).replaceText('pass');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).replaceText('pass');
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // might not always work first time
    await sleep(3000); // propagate
    await element(by.id('PlausibleDeniabilityButton')).tap();

    // trying to enable plausible denability
    await element(by.id('CreateFakeStorageButton')).tap();
    if (process.env.TRAVIS) await sleep(3000); // hopefully helps prevent crash
    await element(by.id('PasswordInput')).replaceText('fake');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('ConfirmPasswordInput')).replaceText('fake'); // retyping
    await element(by.id('ConfirmPasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // might not always work first time
    await sleep(3000); // propagate
    // created fake storage.
    // creating a wallet inside this fake storage
    await helperCreateWallet();

    // relaunch app
    await device.launchApp({ newInstance: true });
    //
    await waitForText('Your storage is encrypted. Password is required to decrypt it.');
    await element(by.type('android.widget.EditText')).typeText('pass');
    await element(by.text('OK')).tap();
    await waitForId('WalletsList');

    // previously created wallet IN MAIN STORAGE should be visible
    await expect(element(by.id('cr34t3d'))).toBeVisible();

    // now go to settings, and decrypt
    await element(by.id('SettingsButton')).tap();
    await element(by.id('SecurityButton')).tap();

    // putting FAKE storage password. should not succeed
    await element(by.id('EncyptedAndPasswordProtectedSwitch')).tap();
    await element(by.text('OK')).tap();
    await element(by.id('PasswordInput')).replaceText('fake');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // might not always work first time
    await sleep(3000); // propagate
    // correct password
    await element(by.id('PasswordInput')).clearText();
    await element(by.id('PasswordInput')).replaceText('pass');
    await element(by.id('PasswordInput')).tapReturnKey();
    await element(by.id('OKButton')).tap();
    await tapIfPresent('OKButton'); // might not always work first time
    await sleep(3000); // propagate

    // relaunch app
    await device.launchApp({ newInstance: true });
    await waitForId('cr34t3d'); // success

    process.env.TRAVIS && require('fs').writeFileSync(lockFile, '1');
  });

  it('can create wallet and delete wallet', async () => {
    const lockFile = '/tmp/travislock.' + hashIt('t9');
    if (process.env.TRAVIS) {
      if (require('fs').existsSync(lockFile)) return console.warn('skipping', JSON.stringify('t9'), 'as it previously passed on Travis');
    }
    await device.launchApp({ delete: true }); // reinstalling the app just for any case to clean up app's storage
    await helperCreateWallet();
    // nop
    await helperDeleteWallet();
    process.env.TRAVIS && require('fs').writeFileSync(lockFile, '1');
  });
});
