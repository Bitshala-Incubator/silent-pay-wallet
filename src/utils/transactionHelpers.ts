import { Transaction } from '../class/wallets/types';

export const shortenAddress = (address: string): string => {
  return address.substr(0, 4) + '...' + address.substr(address.length - 4, 4);
};

export const getRelevantAddress = (item: Transaction): string | null => {
  // outgoing transactions, show the destination address
  if (item.value && item.value < 0) {
    // first output address that's not ours (change address)
    if (item.outputs && item.outputs.length > 0) {
      for (const output of item.outputs) {
        if (output.scriptPubKey?.addresses?.[0]) {
          return output.scriptPubKey.addresses[0];
        }
      }
    }
  } else {
    // incoming transactions, show the receiving address
    if (item.outputs && item.outputs.length > 0) {
      for (const output of item.outputs) {
        if (output.scriptPubKey?.addresses?.[0]) {
          return output.scriptPubKey.addresses[0];
        }
      }
    }
  }

  return null;
};
