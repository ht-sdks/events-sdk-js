/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import { NAME } from './constants';
import logger from '../../utils/logUtil';
import { isDefinedAndNotNull } from '../../utils/commonUtils';
import ScriptLoader from '../../utils/ScriptLoader';

class Vero {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.analytics = analytics;
    this.apiKey = config.apiKey;
    this.name = NAME;
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
  }

  init() {
    logger.debug('===In init Vero===');
    window._veroq = window._veroq || [];
    ScriptLoader('vero-integration', 'https://d3qxef4rp70elm.cloudfront.net/m.js');
    window._veroq.push(['init', { api_key: this.apiKey }]);
  }

  isLoaded() {
    logger.debug('===In isLoaded Vero===');
    return !!window._veroq && typeof window._veroq === 'object';
  }

  isReady() {
    logger.debug('===In isReady Vero===');
    return !!window._veroq && !!window._veroq.ready;
  }

  /**
   * AddOrRemoveTags.
   * This block handles any tag addition or removal requests.
   * Ref - http://developers.getvero.com/?javascript#tags
   *
   * @param {Object} tags
   */
  addOrRemoveTags(message) {
    const { integrations, anonymousId, userId } = message;
    if (integrations?.[NAME]) {
      const { tags } = integrations[NAME];
      if (isDefinedAndNotNull(tags)) {
        const id = userId || anonymousId;
        const addTags = Array.isArray(tags.add) ? tags.add : [];
        const removeTags = Array.isArray(tags.remove) ? tags.remove : [];
        window._veroq.push([
          'tags',
          {
            id,
            add: addTags,
            remove: removeTags,
          },
        ]);
      }
    }
  }

  /**
   * Identify.
   * Ref - https://developers.getvero.com/?javascript#users-identify
   *
   * @param {Identify} identify
   */
  identify(htElement) {
    const { message } = htElement;
    const { traits } = message.context || message;
    const userId = message.userId || message.anonymousId;
    let payload = traits;
    if (userId) {
      payload = { id: userId, ...payload };
    }
    window._veroq.push(['user', payload]);
    this.addOrRemoveTags(message);
  }

  /**
   * Track - tracks an event for a specific user
   * for event `unsubscribe`
   * Ref - https://developers.getvero.com/?javascript#users-unsubscribe
   * for event `resubscribe`
   * Ref - https://developers.getvero.com/?javascript#users-resubscribe
   * else
   * Ref - https://developers.getvero.com/?javascript#events-track
   *
   * @param {Track} track
   */
  track(htElement) {
    logger.debug('=== In Vero track ===');

    const { message } = htElement;
    const { event, properties, anonymousId, userId } = message;
    if (!event) {
      logger.error('[Vero]: Event name from track call is missing!!===');
      return;
    }
    const id = userId || anonymousId;
    switch (event.toLowerCase()) {
      case 'unsubscribe':
        window._veroq.push(['unsubscribe', id]);
        break;
      case 'resubscribe':
        window._veroq.push(['resubscribe', id]);
        break;
      default:
        window._veroq.push(['track', event, properties]);
    }
    this.addOrRemoveTags(message);
  }

  /**
   * Page.
   *
   * @param {Page} page
   */
  page(htElement) {
    logger.debug('=== In Vero Page ===');
    const { name, category } = htElement.message;
    let eventName;
    if (!name && !category) {
      eventName = `Viewed Page`;
    } else if (!name && category) {
      eventName = `Viewed ${category} Page`;
    } else if (name && !category) {
      eventName = `Viewed ${name} Page`;
    } else {
      eventName = `Viewed ${category} ${name} Page`;
    }
    const elemClone = { ...htElement };
    elemClone.message = { ...htElement.message };
    elemClone.message.event = eventName;
    this.track(elemClone);
  }

  /**
   * Alias.
   * Ref - https://www.getvero.com/api/http/#users
   *
   * @param {Alias} alias
   */
  alias(htElement) {
    const { message } = htElement;
    const { userId, previousId } = message;
    if (!previousId) {
      logger.error('===Vero: previousId is required for alias call===');
      return;
    }
    if (!userId) {
      logger.error('===Vero: userId is required for alias call===');
      return;
    }
    window._veroq.push(['reidentify', userId, previousId]);
    this.addOrRemoveTags(message);
  }
}

export default Vero;
