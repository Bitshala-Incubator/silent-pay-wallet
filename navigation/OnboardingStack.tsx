import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnboardingScreen from "../screen/wallets/OnboardingScreen";
import CreateWalletScreen from "../screen/wallets/CreateWalletScreen";
import PleaseBackup from "../screen/wallets/PleaseBackup";
import { RouteProp } from '@react-navigation/native';
import ImportWallet from "../screen/wallets/ImportWallet";

export type OnboardingStackParamList = {
    OnboardingMain: undefined;
    CreateWalletScreen: undefined;
    PleaseBackup: { walletID: string };
    ImportWallet: undefined;
}

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingStack = ({ route }: { route?: RouteProp<any, any> }) => {
    const initialRouteName = route?.params?.screen || 'OnboardingMain';
    const initialParams = route?.params?.params || undefined;
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false, headerBackVisible: false }} initialRouteName={initialRouteName}>
            <Stack.Screen name="OnboardingMain" component={OnboardingScreen} />
            <Stack.Screen name="CreateWalletScreen" component={CreateWalletScreen} initialParams={initialParams} />
            <Stack.Screen name="PleaseBackup" component={PleaseBackup} />
            <Stack.Screen name="ImportWallet" component={ImportWallet} />
        </Stack.Navigator>
    );
};

export default OnboardingStack;