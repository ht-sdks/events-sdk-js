/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import { NAME } from './constants';
import logger from '../../utils/logUtil';
import ScriptLoader from '../../utils/ScriptLoader';
import { trigger } from './utils';

class ConvertFlow {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.analytics = analytics;
    this.websiteId = config.websiteId;
    this.toggleToSendData = config.toggleToSendData;
    this.eventsList = config.eventsList;
    this.eventsMappping = config.eventsMappping;
    this.name = NAME;
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
  }

  init() {
    logger.debug('===In init convertflow===');
    ScriptLoader(
      'convertflow-integration',
      `https://js.convertflow.co/production/websites/${this.websiteId}.js`,
    );
  }

  isLoaded() {
    logger.debug('===In isLoaded convertflow===');
    if (this.toggleToSendData) {
      trigger(this.eventsMappping, this.eventsList, this.analytics);
    }
    return !!window.convertflow && typeof window.convertflow === 'object';
  }

  isReady() {
    logger.debug('===In isReady convertflow===');
    return !!window.convertflow;
  }

  identify(htElement) {
    logger.debug('===In convertflow Identify===');
    const { message } = htElement;
    const email = message.context.traits?.email || message.traits?.email;
    if (!email) {
      logger.error('email is required for identify call');
    }
    const payload = { email, override: true };
    window.convertflow.identify(payload);
  }
}

export default ConvertFlow;
