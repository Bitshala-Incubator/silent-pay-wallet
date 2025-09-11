import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import OnboardingScreen from "../screen/wallets/OnboardingScreen";
export type OnboardingStackParamList = {
    OnboardingMain: undefined;
}

const Stack = createNativeStackNavigator<OnboardingStackParamList>();

const OnboardingStack = () => {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="OnboardingMain" component={OnboardingScreen} />
        </Stack.Navigator>
    );
};

export default OnboardingStack;