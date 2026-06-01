import * as Haptics from 'expo-haptics';
import { isDesktop } from './environment';

// Define a const enum for HapticFeedbackTypes
export const enum HapticFeedbackTypes {
  ImpactLight = 'impactLight',
  ImpactMedium = 'impactMedium',
  ImpactHeavy = 'impactHeavy',
  Selection = 'selection',
  NotificationSuccess = 'notificationSuccess',
  NotificationWarning = 'notificationWarning',
  NotificationError = 'notificationError',
}

// Maps our enum values to expo-haptics equivalents
const impactStyleMap: Record<string, Haptics.ImpactFeedbackStyle> = {
  [HapticFeedbackTypes.ImpactLight]: Haptics.ImpactFeedbackStyle.Light,
  [HapticFeedbackTypes.ImpactMedium]: Haptics.ImpactFeedbackStyle.Medium,
  [HapticFeedbackTypes.ImpactHeavy]: Haptics.ImpactFeedbackStyle.Heavy,
};

const notificationTypeMap: Record<string, Haptics.NotificationFeedbackType> = {
  [HapticFeedbackTypes.NotificationSuccess]: Haptics.NotificationFeedbackType.Success,
  [HapticFeedbackTypes.NotificationWarning]: Haptics.NotificationFeedbackType.Warning,
  [HapticFeedbackTypes.NotificationError]: Haptics.NotificationFeedbackType.Error,
};

const triggerHapticFeedback = (type: HapticFeedbackTypes) => {
  if (isDesktop) return;

  if (type === HapticFeedbackTypes.Selection) {
    Haptics.selectionAsync();
  } else if (impactStyleMap[type]) {
    Haptics.impactAsync(impactStyleMap[type]);
  } else if (notificationTypeMap[type]) {
    Haptics.notificationAsync(notificationTypeMap[type]);
  }
};

export const triggerWarningHapticFeedback = () => {
  triggerHapticFeedback(HapticFeedbackTypes.NotificationWarning);
};

export const triggerSelectionHapticFeedback = () => {
  triggerHapticFeedback(HapticFeedbackTypes.Selection);
};

export default triggerHapticFeedback;
