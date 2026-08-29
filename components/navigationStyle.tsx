import { NativeStackNavigationOptions } from '@react-navigation/native-stack';
import React from 'react';
import { Image, Keyboard, Platform, StyleSheet, TouchableOpacity } from 'react-native';

import { ClashFont } from '../constants/fonts';
import loc from '../loc';
import { Theme } from './themes';
import HeaderBackButton from './HeaderBackButton';

const styles = StyleSheet.create({
  button: {
    minWidth: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonFormSheet: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 30,
    height: 30,
    borderRadius: 15,
    marginLeft: 22,
  },
});

enum CloseButtonPosition {
  None = 'None',
  Left = 'Left',
  Right = 'Right',
}

type OptionsFormatter = (
  options: NativeStackNavigationOptions,
  deps: { theme: Theme; navigation: any; route: any },
) => NativeStackNavigationOptions;

type NavigationOptionsGetter = (theme: Theme) => (deps: { navigation: any; route: any }) => NativeStackNavigationOptions;

const getCloseButtonPosition = (
  closeButtonPosition: CloseButtonPosition | undefined,
  isFirstRouteInStack: boolean,
  isModal: boolean,
): CloseButtonPosition => {
  if (closeButtonPosition !== undefined) {
    return closeButtonPosition;
  }
  if (isFirstRouteInStack && isModal) {
    return CloseButtonPosition.Right;
  }
  return CloseButtonPosition.None;
};

const getHandleCloseAction = (
  onCloseButtonPressed: ((args: { navigation: any; route: any }) => void) | undefined,
  navigation: any,
  route: any,
) => {
  if (onCloseButtonPressed) {
    return () => onCloseButtonPressed({ navigation, route });
  }
  return () => {
    Keyboard.dismiss();
    navigation.goBack(null);
  };
};

const navigationStyle = (
  {
    closeButtonPosition,
    onCloseButtonPressed,
    ...opts
  }: NativeStackNavigationOptions & {
    closeButtonPosition?: CloseButtonPosition;
    onCloseButtonPressed?: (deps: { navigation: any; route: any }) => void;
  },
  formatter?: OptionsFormatter,
): NavigationOptionsGetter => {
  return theme =>
    ({ navigation, route }) => {
      const isFirstRouteInStack = navigation.getState().index === 0;
      const isModal = opts.presentation === 'modal' || opts.presentation === 'transparentModal';
      const isFormSheet = opts.presentation === 'formSheet';

      const closeButton = getCloseButtonPosition(closeButtonPosition, isFirstRouteInStack, isModal);
      const handleClose = getHandleCloseAction(onCloseButtonPressed, navigation, route);

      let headerRight;
      let headerLeft;

      const renderCloseButton = () => (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={loc._.close}
          style={isFormSheet ? [styles.buttonFormSheet, { backgroundColor: theme.colors.lightButton }] : styles.button}
          onPress={handleClose}
          testID="NavigationCloseButton"
        >
          <Image source={theme.closeImage} />
        </TouchableOpacity>
      );

      if (closeButton === CloseButtonPosition.Right) {
        headerRight = renderCloseButton;
      } else if (closeButton === CloseButtonPosition.Left) {
        headerLeft = renderCloseButton;
      }

      if (closeButton === CloseButtonPosition.None) {
        headerLeft = (props: any) =>
          props.canGoBack ? (
            <HeaderBackButton
              color={theme.colors.backButtonIcon}
              onPress={() => {
                Keyboard.dismiss();
                navigation.goBack();
              }}
            />
          ) : null;
      }

      const baseHeaderStyle = {
        headerShadowVisible: false,
        headerTitleAlign: 'center' as const,
        headerTitleStyle: {
          fontFamily: ClashFont.medium,
          fontSize: 17,
          color: theme.colors.foregroundColor,
        },
        headerTintColor: theme.colors.foregroundColor,
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
      };
      const isLeftCloseButtonAndroid = closeButton === CloseButtonPosition.Left && Platform.OS === 'android';

      const leftCloseButtonStyle = isLeftCloseButtonAndroid ? { headerBackImageSource: theme.closeImage } : { headerLeft };

      let options: NativeStackNavigationOptions = {
        ...baseHeaderStyle,
        ...leftCloseButtonStyle,
        headerRight,
        ...opts,
      };

      if (formatter) {
        options = formatter(options, { theme, navigation, route });
      }

      return options;
    };
};

export default navigationStyle;
export { CloseButtonPosition };
