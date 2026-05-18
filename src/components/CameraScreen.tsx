import React, { useState } from 'react';
import { Animated, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';

import { isDesktop } from '../modules/environment';
import { triggerSelectionHapticFeedback } from '../modules/hapticFeedback';
import loc from '../loc';
import { Icon } from '@rneui/base';

interface CameraScreenProps {
  onCancelButtonPress: () => void;
  showImagePickerButton?: boolean;
  showFilePickerButton?: boolean;
  onImagePickerButtonPress?: () => void;
  onFilePickerButtonPress?: () => void;
  onReadCode?: (event: BarcodeScanningResult) => void;
}

const CameraScreen: React.FC<CameraScreenProps> = ({
  onCancelButtonPress,
  showImagePickerButton,
  showFilePickerButton,
  onImagePickerButtonPress,
  onFilePickerButtonPress,
  onReadCode,
}) => {
  const [facing, setFacing] = React.useState<CameraType>('back');
  const [torchMode, setTorchMode] = useState(false);
  const [, requestPermission] = useCameraPermissions();
  const [orientationAnim] = useState(new Animated.Value(3));

  const onSwitchCameraPressed = () => {
    setFacing(f => (f === 'back' ? 'front' : 'back'));
    triggerSelectionHapticFeedback();
  };

  const onSetTorch = () => {
    setTorchMode(!torchMode);
    triggerSelectionHapticFeedback();
  };

  // Counter-rotate the icons to indicate the actual orientation of the captured photo.
  // For this example, it'll behave incorrectly since UI orientation is allowed (and already-counter rotates the entire screen)
  // For real phone apps, lock your UI orientation using a library like 'react-native-orientation-locker'
  const rotateUi = true;
  const uiRotation = orientationAnim.interpolate({
    inputRange: [1, 2, 3, 4],
    outputRange: ['180deg', '90deg', '0deg', '-90deg'],
  });
  const uiRotationStyle = rotateUi ? { transform: [{ rotate: uiRotation }] } : {};

  function rotateUiTo(rotationValue: number) {
    Animated.timing(orientationAnim, {
      toValue: rotationValue,
      useNativeDriver: true,
      duration: 200,
      isInteraction: false,
    }).start();
  }

  const handleZoom = (e: { nativeEvent: { zoom: number } }) => {
    console.debug('zoom', e.nativeEvent.zoom);
  };

  const handleOrientationChange = (e: any) => {
    const orientation = e?.nativeEvent?.orientation;
    if (orientation === 'portrait') rotateUiTo(3);
    else if (orientation === 'portrait-upside-down') rotateUiTo(1);
    else if (orientation === 'landscape-left') rotateUiTo(2);
    else if (orientation === 'landscape-right') rotateUiTo(4);
  };

  const handleReadCode = (event: BarcodeScanningResult) => {
    onReadCode?.(event);
  };

  return (
    <View style={styles.screen}>
      {/* Render top buttons only if not desktop as they would not be relevant */}
      {!isDesktop && (
        <View style={styles.topButtons}>
          <TouchableOpacity style={[styles.topButton, uiRotationStyle, torchMode ? styles.activeTorch : {}]} onPress={onSetTorch}>
            <Animated.View style={styles.topButtonImg}>
              {Platform.OS === 'ios' ? (
                <Icon name={torchMode ? 'flashlight-on' : 'flashlight-off'} type="font-awesome-6" color={torchMode ? '#000' : '#fff'} />
              ) : (
                <Icon name={torchMode ? 'flash-on' : 'flash-off'} type="ionicons" color={torchMode ? '#000' : '#fff'} />
              )}
            </Animated.View>
          </TouchableOpacity>
          <View style={styles.rightButtonsContainer}>
            {showImagePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_image}
                style={[styles.topButton, styles.spacing, uiRotationStyle]}
                onPress={onImagePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="image" type="font-awesome" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
            {showFilePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_file}
                style={[styles.topButton, styles.spacing, uiRotationStyle]}
                onPress={onFilePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="file-import" type="font-awesome-5" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.cameraPreview}
          facing={facing}
          enableTorch={torchMode}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleReadCode}
        />
      </View>
      <View style={styles.bottomButtons}>
        <TouchableOpacity onPress={onCancelButtonPress}>
          <Animated.Text style={[styles.backTextStyle, uiRotationStyle]}>{loc._.cancel}</Animated.Text>
        </TouchableOpacity>
        {isDesktop ? (
          <View style={styles.rightButtonsContainer}>
            {showImagePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_image}
                style={[styles.bottomButton, styles.spacing, uiRotationStyle]}
                onPress={onImagePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="image" type="font-awesome" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
            {showFilePickerButton && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel={loc._.pick_file}
                style={[styles.bottomButton, styles.spacing, uiRotationStyle]}
                onPress={onFilePickerButtonPress}
              >
                <Animated.View style={styles.topButtonImg}>
                  <Icon name="file-import" type="font-awesome-5" color="#ffffff" />
                </Animated.View>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <TouchableOpacity style={[styles.bottomButton, uiRotationStyle]} onPress={onSwitchCameraPressed}>
            <Animated.View style={[styles.topButtonImg, uiRotationStyle]}>
              {Platform.OS === 'ios' ? (
                <Icon name="cameraswitch" type="font-awesome-6" color="#ffffff" />
              ) : (
                <Icon name={facing === 'back' ? 'camera-rear' : 'camera-front'} type="ionicons" color="#ffffff" />
              )}
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export default CameraScreen;

const styles = StyleSheet.create({
  activeTorch: {
    backgroundColor: '#fff',
  },
  screen: {
    height: '100%',
    backgroundColor: '#000000',
  },
  topButtons: {
    padding: 10,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topButton: {
    backgroundColor: '#222',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topButtonImg: {
    margin: 10,
    width: 24,
    height: 24,
  },
  cameraContainer: {
    justifyContent: 'center',
    flex: 1,
  },
  cameraPreview: {
    width: '100%',
    height: '100%',
  },
  bottomButtons: {
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backTextStyle: {
    padding: 10,
    color: 'white',
    fontSize: 20,
  },
  rightButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bottomButton: {
    backgroundColor: '#222',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  spacing: {
    marginLeft: 20,
  },
});
