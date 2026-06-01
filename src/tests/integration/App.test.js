/* eslint react/prop-types: "off" */
import React from 'react';
import { render } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { Header } from '../../components/Header';
import SelfTest from '../../screens/settings/SelfTest';
import Settings from '../../screens/settings/Settings';
import { BlueDefaultTheme } from '../../components/themes';

jest.mock('../../modules/Electrum', () => {
  return {
    connectMain: jest.fn(),
  };
});

const Wrapper = ({ children }) => <NavigationContainer theme={BlueDefaultTheme}>{children}</NavigationContainer>;

it('Header works', () => {
  const { toJSON } = render(
    <Wrapper>
      <Header />
    </Wrapper>,
  );
  expect(toJSON()).toBeTruthy();
});

// eslint-disable-next-line jest/no-disabled-tests
it.skip('Settings work', () => {
  const { toJSON } = render(
    <Wrapper>
      <Settings />
    </Wrapper>,
  );
  expect(toJSON()).toBeTruthy();
});

it('SelfTest work', () => {
  const { toJSON, getByText } = render(
    <Wrapper>
      <SelfTest />
    </Wrapper>,
  );
  expect(toJSON()).toBeTruthy();
  expect(getByText('OK')).toBeTruthy();
});
