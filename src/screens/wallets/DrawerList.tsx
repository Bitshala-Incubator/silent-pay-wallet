import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import React, { memo, useCallback, useMemo } from 'react';
import { InteractionManager, StyleSheet, ViewStyle } from 'react-native';
import { TWallet } from '../../class/wallets/types';
import { Header } from '../../components/Header';
import { useTheme } from '../../components/themes';
import { WalletCarouselItem } from '../../components/WalletsCarousel';
import loc from '../../loc';
import { useStorage } from '../../hooks/context/useStorage';

const DrawerList: React.FC<DrawerContentComponentProps> = memo((props: DrawerContentComponentProps) => {
  const drawerNavigation = props.navigation;
  const { wallets } = useStorage();
  const { colors } = useTheme();

  const stylesHook = useMemo(
    () =>
      StyleSheet.create({
        root: { backgroundColor: colors.elevated } as ViewStyle,
      }),
    [colors.elevated],
  );

  const handleClick = useCallback(
    (item?: TWallet) => {
      if (item?.getID) {
        const walletID = item.getID();
        const walletType = item.type;
        InteractionManager.runAfterInteractions(() => {
          drawerNavigation.navigate('DetailViewStackScreensStack', {
            screen: 'WalletTransactions',
            params: { walletID, walletType },
          });
          drawerNavigation.closeDrawer();
        });
      }
    },
    [drawerNavigation],
  );

  const wallet = wallets[0];

  return (
    <DrawerContentScrollView
      {...props}
      contentContainerStyle={stylesHook.root}
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustContentInsets={true}
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
      directionalLockEnabled
    >
      <Header leftText={loc.wallets.list_title} isDrawerList />
      {wallet && <WalletCarouselItem item={wallet} onPress={handleClick} horizontal={false} />}
    </DrawerContentScrollView>
  );
});

export default DrawerList;
