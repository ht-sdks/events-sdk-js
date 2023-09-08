import * as hightouchevents from 'events-sdk-js';
import { initSanitySuite } from './testBook/index';

const getWriteKey = () => {
  switch ('FEATURE') {
    case 'preloadBuffer':
      return 'FEATURE_PRELOAD_BUFFER_WRITE_KEY';
    case 'eventFiltering':
      return 'FEATURE_EVENT_FILTERING_WRITE_KEY';
    default:
      return 'WRITE_KEY';
  }
};

const getLoadOptions = () => {
  switch ('FEATURE') {
    case 'preloadBuffer':
      return {
        logLevel: 'DEBUG',
        configUrl: 'CONFIG_SERVER_HOST',
        lockIntegrationsVersion: true,
        destSDKBaseURL: 'DESTINATIONS_SDK_BASE_URL',
        cookieConsentManager: {
          oneTrust: {
            enabled: true,
          },
        },
      };
    case 'eventFiltering':
      return {
        logLevel: 'DEBUG',
        configUrl: 'CONFIG_SERVER_HOST',
        lockIntegrationsVersion: true,
        destSDKBaseURL: 'DESTINATIONS_SDK_BASE_URL',
        cookieConsentManager: {
          oneTrust: {
            enabled: true,
          },
        },
      };
    default:
      return {
        logLevel: 'DEBUG',
        configUrl: 'CONFIG_SERVER_HOST',
        lockIntegrationsVersion: true,
        destSDKBaseURL: 'DESTINATIONS_SDK_BASE_URL',
        cookieConsentManager: {
          oneTrust: {
            enabled: true,
          },
        },
      };
  }
};

hightouchevents.load(getWriteKey(), 'DATA_PLANE_URL', getLoadOptions());

hightouchevents.ready(() => {
  console.log('We are all set!!!');
  initSanitySuite();
});

window.hightouchevents = hightouchevents;

export { hightouchevents };
