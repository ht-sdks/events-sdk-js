jest.setTimeout(60000);

const documentHTML = '<script></script>';

global.window.document.body.innerHTML = documentHTML;
global.window.innerWidth = 1680;
global.window.innerHeight = 1024;

// Setup mocking for window.navigator
const defaultUserAgent = window.navigator.userAgent;
const defaultLanguage = window.navigator.language;
Object.defineProperty(
  window.navigator,
  'userAgent',
  ((value) => ({
    get() {
      return value || defaultUserAgent;
    },
    set(v) {
      value = v;
    },
  }))(window.navigator.userAgent),
);

Object.defineProperty(
  window.navigator,
  'brave',
  ((value) => ({
    get() {
      return value;
    },
    set(v) {
      value = v;
    },
  }))(window.navigator.userAgent),
);

Object.defineProperty(
  window.navigator,
  'language',
  ((value) => ({
    get() {
      return value || defaultLanguage;
    },
    set(v) {
      value = v;
    },
  }))(window.navigator.userAgent),
);
