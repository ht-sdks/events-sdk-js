/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import logger from '../../utils/logUtil';
import { NAME } from './constants';
import { loadNativeSdk } from './nativeSdkLoader';

class CustomerIO {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.analytics = analytics;
    this.siteID = config.siteID;
    this.apiKey = config.apiKey;
    this.datacenterEU = config.datacenterEU;
    this.sendPageNameInSDK = config.sendPageNameInSDK;
    this.name = NAME;
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
  }

  init() {
    logger.debug('===in init Customer IO init===');
    const { siteID, datacenterEU } = this;
    loadNativeSdk(siteID, datacenterEU);
  }

  identify(htElement) {
    logger.debug('in Customer IO identify');
    const { userId, context } = htElement.message;
    const { traits } = context || {};
    if (!userId) {
      logger.error('userId is required for Identify call.');
      return;
    }
    const createAt = traits.createdAt;
    if (createAt) {
      traits.created_at = Math.floor(new Date(createAt).getTime() / 1000);
    }
    traits.id = userId;
    window._cio.identify(traits);
  }

  track(htElement) {
    logger.debug('in Customer IO track');

    const eventName = htElement.message.event;
    const { properties } = htElement.message;
    window._cio.track(eventName, properties);
  }

  page(htElement) {
    logger.debug('in Customer IO page');
    if (this.sendPageNameInSDK === false) {
      window._cio.page(htElement.message.properties);
    } else {
      const name = htElement.message.name || htElement.message.properties.url;
      window._cio.page(name, htElement.message.properties);
    }
  }

  isLoaded() {
    return !!(window._cio && window._cio.push !== Array.prototype.push);
  }

  isReady() {
    return !!(window._cio && window._cio.push !== Array.prototype.push);
  }
}

export { CustomerIO };
