import BIP32Factory from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import React, { Component } from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';

import * as Electrum from '../../modules/Electrum';
import * as encryption from '../../modules/encryption';
import * as fs from '../../modules/fs';
import ecc from '../../modules/noble_ecc';
import { ShroudText } from '../../ShroudComponents';
import presentAlert from '../../components/Alert';
import Button from '../../components/Button';
import SaveFileButton from '../../components/SaveFileButton';
import loc from '../../loc';
import { Spacing20 } from '../../components/Spacing';
import { Loading } from '../../components/Loading.tsx';

const bip32 = BIP32Factory(ecc);

type TState = {
  isLoading?: boolean;
  isOk?: boolean;
  errorMessage?: string;
};

function assertStrictEqual<T>(actual: T, expected: T, message?: string) {
  if (expected !== actual) {
    throw new Error(message || 'Assertion failed that ' + JSON.stringify(expected) + ' equals ' + JSON.stringify(actual));
  }
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
});

export default class SelfTest extends Component {
  state: TState;

  constructor(props: any) {
    super(props);
    this.state = {
      isLoading: true,
    };
  }

  onPressImportDocument = async () => {
    try {
      fs.showFilePickerAndReadFile().then(file => {
        if (file && file.data && file.data.length > 0) {
          presentAlert({ message: file.data });
        } else {
          presentAlert({ message: 'Error reading file' });
        }
      });
    } catch (err) {
      console.log(err);
    }
  };

  async componentDidMount() {
    console.debug('SelfTest - componentDidMount');
    let errorMessage = '';
    let isOk = true;

    try {
      //

      if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
        await Electrum.ping();
        await Electrum.waitTillConnected();
        const addr4elect = '3GCvDBAktgQQtsbN6x5DYiQCMmgZ9Yk8BK';
        const electrumBalance = await Electrum.getBalanceByAddress(addr4elect);
        if (electrumBalance.confirmed !== 51432)
          throw new Error('Electrum getBalanceByAddress failure, got ' + JSON.stringify(electrumBalance));

        const electrumTxs = await Electrum.getTransactionsByAddress(addr4elect);
        if (electrumTxs.length !== 1) throw new Error('Electrum getTransactionsByAddress failure, got ' + JSON.stringify(electrumTxs));
      } else {
        // skipping RN-specific test'
      }

      //

      const data2encrypt = 'really long data string';
      const crypted = encryption.encrypt(data2encrypt, 'password');
      const decrypted = encryption.decrypt(crypted, 'password');

      if (decrypted !== data2encrypt) {
        throw new Error('encryption lib is not ok');
      }

      //
      const mnemonic =
        'honey risk juice trip orient galaxy win situate shoot anchor bounce remind horse traffic exotic since escape mimic ramp skin judge owner topple erode';
      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const root = bip32.fromSeed(seed);

      const path = "m/49'/0'/0'/0/0";
      const child = root.derivePath(path);
      const address = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({
          pubkey: child.publicKey,
          network: bitcoin.networks.bitcoin,
        }),
        network: bitcoin.networks.bitcoin,
      }).address;

      if (address !== '3GcKN7q7gZuZ8eHygAhHrvPa5zZbG5Q1rK') {
        throw new Error('bip49 is not ok');
      }

      //

      if (typeof navigator !== 'undefined' && navigator.product === 'ReactNative') {
        assertStrictEqual(
          await Linking.canOpenURL('https://github.com/Bitshala-Incubator/silent-pay-wallet/'),
          true,
          'Linking can not open https url',
        );
      } else {
        // skipping RN-specific test'
      }

      //

      assertStrictEqual(Buffer.from('00ff0f', 'hex').reverse().toString('hex'), '0fff00');

      //
    } catch (Err) {
      console.log(Err);
      errorMessage += Err;
      isOk = false;
    }

    this.setState({
      isLoading: false,
      isOk,
      errorMessage,
    });
  }

  render() {
    return (
      <ScrollView automaticallyAdjustContentInsets contentInsetAdjustmentBehavior="automatic">
        <Spacing20 />

        {this.state.isLoading ? (
          <Loading testID="SelfTestLoading" />
        ) : (
          (() => {
            if (this.state.isOk) {
              return (
                <View style={styles.center}>
                  <ShroudText testID="SelfTestOk" h4>
                    OK
                  </ShroudText>
                  <Spacing20 />
                  <ShroudText>{loc.settings.about_selftest_ok}</ShroudText>
                </View>
              );
            } else {
              return (
                <View style={styles.center}>
                  <ShroudText h4 numberOfLines={0}>
                    {this.state.errorMessage}
                  </ShroudText>
                </View>
              );
            }
          })()
        )}
        <Spacing20 />
        <SaveFileButton fileName="shroud-selftest.txt" fileContent={'Success on ' + new Date().toUTCString()}>
          <Button title="Test Save to Storage" />
        </SaveFileButton>
        <Spacing20 />
        <Button title="Test File Import" onPress={this.onPressImportDocument} />
      </ScrollView>
    );
  }
}
