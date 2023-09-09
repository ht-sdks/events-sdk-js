/* eslint-disable no-undef */
/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import get from 'get-value';
import logger from '../../utils/logUtil';
import { getXhrHeaders, getPropertyBlackList } from './utils';
import { removeTrailingSlashes } from '../../utils/utils';
import { NAME } from './constants';
import { loadNativeSdk } from './nativeSdkLoader';

class Posthog {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.name = NAME;
    this.analytics = analytics;
    this.teamApiKey = config.teamApiKey;
    this.yourInstance = removeTrailingSlashes(config.yourInstance) || 'https://app.posthog.com';
    this.autocapture = config.autocapture || false;
    this.capturePageView = config.capturePageView || false;
    this.disableSessionRecording = config.disableSessionRecording || false;
    this.disableCookie = config.disableCookie || false;
    this.propertyBlackList = getPropertyBlackList(config);
    this.xhrHeaders = getXhrHeaders(config);
    this.enableLocalStoragePersistence = config.enableLocalStoragePersistence;
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
  }

  init() {
    const options = this.analytics.loadOnlyIntegrations[this.name];
    if (options && !options.loadIntegration) {
      logger.debug('===[POSTHOG]: loadIntegration flag is disabled===');
      return;
    }
    loadNativeSdk();

    const configObject = {
      api_host: this.yourInstance,
      autocapture: this.autocapture,
      capture_pageview: this.capturePageView,
      disable_session_recording: this.disableSessionRecording,
      property_blacklist: this.propertyBlackList,
      disable_cookie: this.disableCookie,
    };

    if (options?.loaded) {
      configObject.loaded = options.loaded;
    }
    if (this.xhrHeaders && Object.keys(this.xhrHeaders).length > 0) {
      configObject.xhr_headers = this.xhrHeaders;
    }
    if (this.enableLocalStoragePersistence) {
      configObject.persistence = 'localStorage+cookie';
    }

    posthog.init(this.teamApiKey, configObject);
  }

  isLoaded() {
    logger.debug('in Posthog isLoaded');
    return !!window?.posthog?.__loaded;
  }

  isReady() {
    return !!window?.posthog?.__loaded;
  }

  /**
   * superproperties should be part of rudderelement.message.integrations.POSTHOG object.
   * Once we call the posthog.register api, the corresponding property will be sent along with subsequent capture calls.
   * To remove the superproperties, we call unregister api.
   */
  processSuperProperties(htElement) {
    const { integrations } = htElement.message;
    if (integrations?.POSTHOG) {
      const { superProperties, setOnceProperties, unsetProperties } = integrations.POSTHOG;
      if (superProperties && Object.keys(superProperties).length > 0) {
        posthog.register(superProperties);
      }
      if (setOnceProperties && Object.keys(setOnceProperties).length > 0) {
        posthog.register_once(setOnceProperties);
      }
      if (unsetProperties && unsetProperties.length > 0) {
        unsetProperties.forEach((property) => {
          if (property && property.trim() !== '') {
            posthog.unregister(property);
          }
        });
      }
    }
  }

  identify(htElement) {
    logger.debug('in Posthog identify');

    // htElement.message.context will always be present as part of identify event payload.
    const { traits } = htElement.message.context;
    const { userId } = htElement.message;

    if (userId) {
      posthog.identify(userId, traits);
    }

    this.processSuperProperties(htElement);
  }

  track(htElement) {
    logger.debug('in Posthog track');

    const { event, properties } = htElement.message;

    this.processSuperProperties(htElement);

    posthog.capture(event, properties);
  }

  /**
   *
   *
   * @memberof Posthog
   */
  page(htElement) {
    logger.debug('in Posthog page');

    this.processSuperProperties(htElement);

    posthog.capture('$pageview');
  }

  group(htElement) {
    logger.debug('in Posthog group');
    const traits = get(htElement.message, 'traits');
    const groupKey = get(htElement.message, 'groupId');
    let groupType;
    if (traits) {
      groupType = get(traits, 'groupType');
      delete traits.groupType;
    }
    if (!groupType || !groupKey) {
      logger.error('groupType and groupKey is required for group call');
      return;
    }
    posthog.group(groupType, groupKey, traits);

    this.processSuperProperties(htElement);
  }
}

export default Posthog;
