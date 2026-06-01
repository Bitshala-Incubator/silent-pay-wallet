/* global __DEV__, localStorage */
if (typeof Buffer === 'undefined') global.Buffer = require('buffer').Buffer;
if (typeof __dirname === 'undefined') global.__dirname = '/';
if (typeof __filename === 'undefined') global.__filename = '';
if (typeof process === 'undefined') {
  global.process = {};
}

process.browser = false;
process.version = '0.0.0';

// Minimalistic process.nextTick implementation
process.nextTick = function (callback, ...args) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function');
  }

  // Use setImmediate if available (better than setTimeout), otherwise fallback to setTimeout
  if (typeof setImmediate !== 'undefined') {
    setImmediate(() => callback(...args));
  } else {
    setTimeout(() => callback(...args), 0);
  }
};

// global.location = global.location || { port: 80 }
const isDev = typeof __DEV__ === 'boolean' && __DEV__;
// NOTE: Do not assign process.env.NODE_ENV here — babel-preset-expo/react-native-dotenv
// replaces process.env.* references with string literals (even on the left side of
// assignments), which produces invalid JS like: 'production' = isDev ? ...
if (typeof localStorage !== 'undefined') {
  localStorage.debug = isDev ? '*' : '';
}
