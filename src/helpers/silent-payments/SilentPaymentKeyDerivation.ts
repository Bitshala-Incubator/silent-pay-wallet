import { BIP32Factory, BIP32Interface } from 'bip32';
import { encodeSilentPaymentAddress } from '@silent-pay/core';
import { Buffer } from 'buffer';
import ecc from '../../modules/noble_ecc';

const bip32 = BIP32Factory(ecc);

interface SilentPaymentKeys {
  scanKey: BIP32Interface;
  spendKey: BIP32Interface;
}

function deriveSilentPaymentKeys(seed: Buffer): SilentPaymentKeys {
  const root = bip32.fromSeed(seed);
  const spendKey = root.derivePath("m/352'/0'/0'/0'/0");
  const scanKey = root.derivePath("m/352'/0'/0'/1'/0");

  return { scanKey, spendKey };
}

export function getScanPrivateKey(seed: Buffer): Uint8Array {
  const { scanKey } = deriveSilentPaymentKeys(seed);
  return new Uint8Array(scanKey.privateKey!);
}

export function getSpendPrivateKey(seed: Buffer): Uint8Array {
  const { spendKey } = deriveSilentPaymentKeys(seed);
  return new Uint8Array(spendKey.privateKey!);
}

export function getScanPublicKey(seed: Buffer): Uint8Array {
  const { scanKey } = deriveSilentPaymentKeys(seed);
  return new Uint8Array(scanKey.publicKey);
}

export function getSpendPublicKey(seed: Buffer): Uint8Array {
  const { spendKey } = deriveSilentPaymentKeys(seed);
  return new Uint8Array(spendKey.publicKey);
}

export function getSilentPaymentAddress(seed: Buffer): string {
  const { scanKey, spendKey } = deriveSilentPaymentKeys(seed);
  return encodeSilentPaymentAddress(new Uint8Array(scanKey.publicKey), new Uint8Array(spendKey.publicKey));
}
