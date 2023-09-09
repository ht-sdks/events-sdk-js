/* eslint-disable class-methods-use-this */
import * as utils from './util';
import * as ecommUtils from './eCommHandle';
import * as heartbeatUtils from './heartbeatHandle';
import { getHashFromArray } from '../../utils/commonUtils';
import ScriptLoader from '../../utils/ScriptLoader';
import logger from '../../utils/logUtil';
import { NAME } from './constants';

class AdobeAnalytics {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.analytics = analytics;
    this.trackingServerUrl = config.trackingServerUrl || '';
    this.reportSuiteIds = config.reportSuiteIds;
    this.heartbeatTrackingServerUrl = config.heartbeatTrackingServerUrl || '';
    this.eventsToTypes = config.eventsToTypes || [];
    this.marketingCloudOrgId = config.marketingCloudOrgId || '';
    this.dropVisitorId = config.dropVisitorId;
    this.trackingServerSecureUrl = config.trackingServerSecureUrl || '';
    this.timestampOption = config.timestampOption;
    this.preferVisitorId = config.preferVisitorId;
    this.rudderEventsToAdobeEvents = config.rudderEventsToAdobeEvents || [];
    this.proxyNormalUrl = config.proxyNormalUrl;
    this.proxyHeartbeatUrl = config.proxyHeartbeatUrl;
    this.pageName = '';
    this.name = NAME;
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
    utils.setConfig(config);
  }

  init() {
    // check if was already initialised. If yes then use already existing.
    window.s_account = window.s_account || this.reportSuiteIds;
    // update playhead value of a session
    window.rudderHBPlayheads = {};
    // load separately as heartbeat sdk is large and need not be required if this is off.
    const heartbeatUrl =
      this.proxyHeartbeatUrl ||
      'https://cdn.rudderlabs.com/adobe-analytics-js/adobe-analytics-js-heartbeat.js';
    const normalUrl =
      this.proxyNormalUrl || 'https://cdn.rudderlabs.com/adobe-analytics-js/adobe-analytics-js.js';
    if (this.heartbeatTrackingServerUrl) {
      ScriptLoader('adobe-analytics-heartbeat', heartbeatUrl);
      this.setIntervalHandler = setInterval(this.initAdobeAnalyticsClient.bind(this), 1000);
    } else {
      ScriptLoader('adobe-analytics-heartbeat', normalUrl);
      this.setIntervalHandler = setInterval(this.initAdobeAnalyticsClient.bind(this), 1000);
    }
  }

  initAdobeAnalyticsClient() {
    const { s, Visitor } = window;
    s.trackingServer = s.trackingServer || this.trackingServerUrl;
    s.trackingServerSecure = s.trackingServerSecure || this.trackingServerSecureUrl;
    if (this.marketingCloudOrgId && Visitor && typeof Visitor.getInstance === 'function') {
      s.visitor = Visitor.getInstance(this.marketingCloudOrgId, {
        trackingServer: s.trackingServer || this.trackingServerUrl,
        trackingServerSecure: s.trackingServerSecure || this.trackingServerSecureUrl,
      });
    }
  }

  isLoaded() {
    logger.debug('in AdobeAnalytics isLoaded');
    return !!(window.s_gi && window.s_gi !== Array.prototype.push);
  }

  isReady() {
    logger.debug('in AdobeAnalytics isReady');
    return !!(window.s_gi && window.s_gi !== Array.prototype.push);
  }

  page(htElement) {
    // delete existing keys from widnow.s
    utils.clearWindowSKeys(utils.getDynamicKeys());
    // The pageName variable typically stores the name of a given page
    let name;
    if (htElement.message.name) {
      name = htElement.message.name;
    } else if (htElement.message.properties) {
      name = htElement.message.properties.name;
    }

    this.pageName = name ? `Viewed Page ${name}` : 'Viewed Page';

    window.s.pageName = this.pageName;

    // The referrer variable overrides the automatically collected referrer in reports.
    let referrer;
    let url;
    if (htElement.message.context && htElement.message.context.page) {
      referrer = htElement.message.context.page.referrer;
      url = htElement.message.context.page.url;
    } else if (htElement.message.properties) {
      referrer = htElement.message.properties.referrer;
      url = htElement.message.properties.url;
    }

    window.s.referrer = referrer;

    // if dropVisitorId is true visitorID will not be set
    /** Cross-device visitor identification uses the visitorID variable to associate a user across devices.
     *  The visitorID variable takes the highest priority when identifying unique visitors.
     * Visitor deduplication is not retroactive: */
    if (!this.dropVisitorId) {
      const { userId } = htElement.message;
      if (userId) {
        if (this.timestampOption === 'disabled') {
          window.s.visitorID = userId;
        }
        // If timestamp hybrid option and visitor id preferred is on visitorID is set
        if (this.timestampOption === 'hybrid' && this.preferVisitorId) {
          window.s.visitorID = userId;
        }
      }
    }
    // update values in window.s
    utils.updateWindowSKeys(this.pageName, 'events');
    utils.updateWindowSKeys(url, 'pageURL');
    utils.updateCommonWindowSKeys(htElement, this.pageName);

    utils.calculateTimestamp(htElement);

    utils.handleContextData(htElement);
    utils.handleEVars(htElement);
    utils.handleHier(htElement);
    utils.handleLists(htElement);
    utils.handleCustomProps(htElement);
    /** The t() method is an important core component to Adobe Analytics. It takes all Analytics variables defined on the page,
     *  compiles them into an image request, and sends that data to Adobe data collection servers.
     * */

    window.s.t();
  }

  track(htElement) {
    utils.clearWindowSKeys(utils.getDynamicKeys());
    const { event } = htElement.message;
    if (this.heartbeatTrackingServerUrl) {
      const eventsToTypesHashmap = getHashFromArray(this.eventsToTypes);
      const heartBeatFunction = eventsToTypesHashmap[event.toLowerCase()];
      // process mapped video events

      this.processHeartbeatMappedEvents(heartBeatFunction, htElement);
    }
    // process unmapped ecomm events
    const isProcessed = this.checkIfRudderEcommEvent(htElement);
    // process mapped events
    if (!isProcessed) {
      const rudderEventsToAdobeEventsHashmap = getHashFromArray(this.rudderEventsToAdobeEvents);
      if (rudderEventsToAdobeEventsHashmap[event.toLowerCase()]) {
        utils.processEvent(
          htElement,
          rudderEventsToAdobeEventsHashmap[event.toLowerCase()].trim(),
          this.pageName,
        );
      }
    }
  }

  /**
   * @param  {} htElement
   * @description Checks if the incoming rudder event is an Ecomm Event. Return true or false accordingly.
   * DOC: https://docs.rudderstack.com/rudderstack-api-spec/rudderstack-ecommerce-events-specification
   * @returns ret
   */

  checkIfRudderEcommEvent(htElement) {
    const { event } = htElement.message;
    let ret = true;
    switch (event.toLowerCase()) {
      case 'product viewed':
      case 'product list viewed':
        ecommUtils.productViewHandle(htElement, this.pageName);
        break;
      case 'product added':
        ecommUtils.productAddedHandle(htElement, this.pageName);
        break;
      case 'product removed':
        ecommUtils.productRemovedHandle(htElement, this.pageName);
        break;
      case 'order completed':
        ecommUtils.orderCompletedHandle(htElement, this.pageName);
        break;
      case 'cart viewed':
        ecommUtils.cartViewedHandle(htElement, this.pageName);
        break;
      case 'checkout started':
        ecommUtils.checkoutStartedHandle(htElement, this.pageName);
        break;
      case 'cart opened':
      case 'opened cart':
        ecommUtils.cartOpenedHandle(htElement, this.pageName);
        break;
      default:
        ret = false;
    }
    return ret;
  }

  /**
   * @param  {} heartBeatFunction
   * @param  {} htElement
   *
   * @description Function to process mapped video events in webapp with adobe video events.
   */

  processHeartbeatMappedEvents(heartBeatFunction, htElement) {
    if (heartBeatFunction) {
      switch (heartBeatFunction) {
        case 'initHeartbeat':
          heartbeatUtils.initHeartbeat(htElement);
          break;
        case 'heartbeatPlaybackStarted':
        case 'heartbeatPlaybackResumed':
        case 'heartbeatContentStarted':
        case 'heartbeatVideoStart':
          heartbeatUtils.heartbeatVideoStart(htElement);
          break;
        case 'heartbeatPlaybackPaused':
        case 'heartbeatPlaybackInterrupted':
        case 'heartbeatVideoPaused':
          heartbeatUtils.heartbeatVideoPaused(htElement);
          break;
        case 'heartbeatContentComplete':
        case 'heartbeatVideoComplete':
          heartbeatUtils.heartbeatVideoComplete(htElement);
          break;
        case 'heartbeatSessionEnd':
        case 'heartbeatPlaybackCompleted':
          heartbeatUtils.heartbeatSessionEnd(htElement);
          break;
        case 'heartbeatAdStarted':
        case 'heartbeatAdBreakStarted':
          heartbeatUtils.heartbeatAdStarted(htElement);
          break;
        case 'heartbeatAdCompleted':
        case 'heartbeatAdBreakCompleted':
          heartbeatUtils.heartbeatAdCompleted(htElement);
          break;
        case 'heartbeatAdSkipped':
          heartbeatUtils.heartbeatAdSkipped(htElement);
          break;
        case 'heartbeatSeekStarted':
          heartbeatUtils.heartbeatSeekStarted(htElement);
          break;
        case 'heartbeatSeekCompleted':
          heartbeatUtils.heartbeatSeekCompleted(htElement);
          break;
        case 'heartbeatBufferStarted':
          heartbeatUtils.heartbeatBufferStarted(htElement);
          break;
        case 'heartbeatBufferCompleted':
          heartbeatUtils.heartbeatBufferCompleted(htElement);
          break;
        case 'heartbeatQualityUpdated':
          heartbeatUtils.heartbeatQualityUpdated(htElement);
          break;
        case 'heartbeatUpdatePlayhead':
          heartbeatUtils.heartbeatUpdatePlayhead(htElement);
          break;
        default:
          logger.error('No heartbeat function for this event');
      }
    }
  }
}

export default AdobeAnalytics;
