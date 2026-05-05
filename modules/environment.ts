import * as Device from 'expo-device';

const isTablet: boolean = Device.deviceType === Device.DeviceType.TABLET;
const isDesktop: boolean = Device.deviceType === Device.DeviceType.DESKTOP;
const isHandset: boolean = Device.deviceType === Device.DeviceType.PHONE;

export { isDesktop, isHandset, isTablet };
