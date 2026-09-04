import React, { useReducer, useRef } from 'react';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../modules/hapticFeedback';
import { ShroudCard, ShroudText } from '../ShroudComponents';
import presentAlert from '../components/Alert';
import Button from '../components/Button';
import loc from '../loc';
import { useStorage } from '../hooks/context/useStorage';
import { useContacts } from '../hooks/context/useContacts';
import PromptPasswordConfirmationModal, {
  PromptPasswordConfirmationModalHandle,
  MODAL_TYPES,
} from '../components/PromptPasswordConfirmationModal';
import { useExtendedNavigation } from '../hooks/useExtendedNavigation';
import { StackActions } from '@react-navigation/native';
import SafeAreaScrollView from '../components/SafeAreaScrollView';
import { Spacing20 } from '../components/Spacing';
import { Loading } from '../components/Loading';

// Action Types
const SET_LOADING = 'SET_LOADING';
const SET_MODAL_TYPE = 'SET_MODAL_TYPE';

// Defining State and Action Types
type State = {
  isLoading: boolean;
  modalType: keyof typeof MODAL_TYPES;
};

type Action = { type: typeof SET_LOADING; payload: boolean } | { type: typeof SET_MODAL_TYPE; payload: keyof typeof MODAL_TYPES };

// Initial State
const initialState: State = {
  isLoading: false,
  modalType: MODAL_TYPES.CREATE_FAKE_STORAGE,
};

// Reducer Function
function reducer(state: State, action: Action): State {
  switch (action.type) {
    case SET_LOADING:
      return { ...state, isLoading: action.payload };
    case SET_MODAL_TYPE:
      return { ...state, modalType: action.payload };
    default:
      return state;
  }
}

// Component
const PlausibleDeniability: React.FC = () => {
  const { cachedPassword, isPasswordInUse, createFakeStorage, resetWallets } = useStorage();
  const { resetContacts } = useContacts();
  const [state, dispatch] = useReducer(reducer, initialState);
  const navigation = useExtendedNavigation();
  const promptRef = useRef<PromptPasswordConfirmationModalHandle>(null);

  const handleOnCreateFakeStorageButtonPressed = async () => {
    dispatch({ type: SET_LOADING, payload: true });
    dispatch({ type: SET_MODAL_TYPE, payload: MODAL_TYPES.CREATE_FAKE_STORAGE });
    await promptRef.current?.present();
  };

  const handleConfirmationSuccess = async (password: string) => {
    let success = false;
    const isProvidedPasswordInUse = password === cachedPassword || (await isPasswordInUse(password));
    if (isProvidedPasswordInUse) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({ message: loc.plausibledeniability.password_should_not_match });
      return false;
    }

    try {
      await createFakeStorage(password);
      resetWallets();
      resetContacts();
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);

      // Set the modal type to SUCCESS to show the success animation instead of the alert
      dispatch({ type: SET_MODAL_TYPE, payload: MODAL_TYPES.SUCCESS });

      success = true;
      setTimeout(async () => {
        const popToTop = StackActions.popToTop();
        navigation.dispatch(popToTop);
      }, 3000);
    } catch {
      success = false;
      dispatch({ type: SET_LOADING, payload: false });
    }

    return success;
  };

  const handleConfirmationFailure = () => {
    dispatch({ type: SET_LOADING, payload: false });
  };

  return (
    <SafeAreaScrollView centerContent={state.isLoading}>
      {state.isLoading ? (
        <Loading />
      ) : (
        <ShroudCard>
          <ShroudText>{loc.plausibledeniability.help}</ShroudText>
          <ShroudText />
          <ShroudText>{loc.plausibledeniability.help2}</ShroudText>
          <Spacing20 />
          <Button
            testID="CreateFakeStorageButton"
            title={loc.plausibledeniability.create_fake_storage}
            onPress={handleOnCreateFakeStorageButtonPressed}
            disabled={state.isLoading}
          />
        </ShroudCard>
      )}
      <PromptPasswordConfirmationModal
        ref={promptRef}
        modalType={state.modalType}
        onConfirmationSuccess={handleConfirmationSuccess}
        onConfirmationFailure={handleConfirmationFailure}
      />
    </SafeAreaScrollView>
  );
};

export default PlausibleDeniability;
