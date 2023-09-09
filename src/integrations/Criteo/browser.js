/* eslint-disable class-methods-use-this */
import logger from '../../utils/logUtil';
import ScriptLoader from '../../utils/ScriptLoader';
import {
  getDeviceType,
  handleListView,
  handlingEventDuo,
  handleProductView,
  generateExtraData,
  handleCommonFields,
} from './utils';
import { NAME, supportedEvents } from './constants';
import { getHashFromArrayWithDuplicate } from '../../utils/commonUtils';

class Criteo {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.analytics = analytics;
    this.name = NAME;
    this.hashMethod = config.hashMethod;
    this.accountId = config.accountId;
    this.url = config.homePageUrl;
    this.deviceType = getDeviceType(navigator.userAgent);
    this.fieldMapping = config.fieldMapping;
    this.eventsToStandard = config.eventsToStandard;
    this.OPERATOR_LIST = ['eq', 'gt', 'lt', 'ge', 'le', 'in'];
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
  }

  init() {
    logger.debug('===in init Criteo===');
    if (!this.accountId) {
      logger.debug('Account ID missing');
      return;
    }
    window.criteo_q = window.criteo_q || [];

    ScriptLoader('Criteo', `//dynamic.criteo.com/js/ld/ld.js?a=${this.accountId}`);
    window.criteo_q.push({ event: 'setAccount', account: this.accountId });
    window.criteo_q.push({ event: 'setSiteType', type: this.deviceType });
  }

  isLoaded() {
    logger.debug('===in Criteo isLoaded===');
    return !!(window.criteo_q && window.criteo_q.push !== Array.prototype.push);
  }

  isReady() {
    logger.debug('===in Criteo isReady===');
    return !!(window.criteo_q && window.criteo_q.push !== Array.prototype.push);
  }

  page(htElement) {
    const { name, properties } = htElement.message;

    const finalPayload = handleCommonFields(htElement, this.hashMethod);

    if (
      name === 'home' ||
      (properties && properties.name === 'home') ||
      (this.url && this.url === window.location.href) ||
      (properties && properties.url === this.url)
    ) {
      const homeEvent = {
        event: 'viewHome',
      };
      finalPayload.push(homeEvent);
    } else {
      logger.debug('[Criteo] Home page is not detected');
      return;
    }

    const extraDataObject = generateExtraData(htElement, this.fieldMapping);
    if (Object.keys(extraDataObject).length > 0) {
      finalPayload.push({ event: 'setData', ...extraDataObject });
    }

    window.criteo_q.push(finalPayload);

    // Final example payload supported by destination
    // window.criteo_q.push(
    //   { event: "setAccount", account: YOUR_PARTNER_ID},
    //   {
    //     event: "setEmail",
    //     email: "##Email Address##",
    //     hash_method: "##Hash Method##",
    //   },
    //   { event: "setSiteType", type: deviceType},
    //   { event: "setCustomerId", id: "##Customer Id##" },
    //   { event: "setRetailerVisitorId", id: "##Visitor Id##"},
    //   { event: "setZipcode", zipcode: "##Zip Code##" },
    //   { event: "viewHome" }
    // );
  }

  track(htElement) {
    const { event, properties } = htElement.message;

    const finalPayload = handleCommonFields(htElement, this.hashMethod);

    if (!event) {
      logger.debug('[Criteo] Event name from track call is missing!!===');
      return;
    }

    if (!properties || Object.keys(properties).length === 0) {
      logger.debug('[Criteo] Either properties object is missing or empty in the track call');
      return;
    }

    const eventMapping = getHashFromArrayWithDuplicate(this.eventsToStandard);
    const trimmedEvent = event.toLowerCase().trim();

    if (!supportedEvents.includes(trimmedEvent) && !eventMapping[trimmedEvent]) {
      logger.debug(`[Criteo] event ${trimmedEvent} is not supported`);
      return;
    }
    let events = [];
    if (supportedEvents.includes(trimmedEvent)) {
      events.push(trimmedEvent);
    } else {
      events = eventMapping[trimmedEvent];
    }

    events.forEach((eventType) => {
      switch (eventType) {
        case 'product viewed':
          handleProductView(htElement.message, finalPayload);
          break;
        case 'cart viewed':
        case 'order completed':
          handlingEventDuo(htElement.message, finalPayload);
          break;
        case 'product list viewed':
          handleListView(htElement.message, finalPayload, this.OPERATOR_LIST);
          break;
        default:
          break;
      }
    });

    const extraDataObject = generateExtraData(htElement, this.fieldMapping);
    if (Object.keys(extraDataObject).length > 0) {
      finalPayload.push({ event: 'setData', ...extraDataObject });
    }
    window.criteo_q.push(finalPayload);
  }
}
export default Criteo;
