import React, { useEffect } from 'react';
import { View } from 'react-native';
import ListItem from '../../components/ListItem';
import useOnAppLaunch from '../../hooks/useOnAppLaunch';
import loc from '../../loc';
import { useStorage } from '../../hooks/context/useStorage';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';

const DefaultView: React.FC = () => {
  const { wallets } = useStorage();
  const { setSelectedDefaultWallet, setViewAllWalletsEnabled } = useOnAppLaunch();

  useEffect(() => {
    // Single-wallet mode: auto-select the only wallet
    if (wallets.length === 1) {
      (async () => {
        await setViewAllWalletsEnabled(false);
        await setSelectedDefaultWallet(wallets[0].getID());
      })().catch(e => console.error('DefaultView: failed to set default wallet', e));
    }
  }, [wallets, setViewAllWalletsEnabled, setSelectedDefaultWallet]);

  return (
    <SafeAreaScrollView automaticallyAdjustContentInsets={false} contentInsetAdjustmentBehavior="automatic">
      <View>
        <ListItem
          title={loc.settings.default_wallets}
          subtitle={wallets.length === 1 ? wallets[0].getLabel() : loc.settings.default_desc}
          disabled
        />
      </View>
    </SafeAreaScrollView>
  );
};

export default DefaultView;
