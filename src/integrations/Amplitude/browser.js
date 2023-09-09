/* eslint-disable no-underscore-dangle */
/* eslint-disable class-methods-use-this */
import Logger from '../../utils/logger';
import { type } from '../../utils/utils';
import { NAME } from './constants';

import { loadNativeSdk } from './nativeSdkLoader';
import { getTraitsToSetOnce, getTraitsToIncrement } from './utils';

const logger = new Logger(NAME);

class Amplitude {
  constructor(config, analytics, destinationInfo) {
    if (analytics.logLevel) {
      logger.setLogLevel(analytics.logLevel);
    }
    this.name = NAME;
    this.analytics = analytics;
    this.apiKey = config.apiKey;
    this.trackAllPages = config.trackAllPages || false;
    this.trackNamedPages = config.trackNamedPages || false;
    this.trackCategorizedPages = config.trackCategorizedPages || false;
    this.trackUtmProperties = config.trackUtmProperties || false;
    this.trackReferrer = config.trackReferrer || false;
    this.batchEvents = config.batchEvents || false;
    this.eventUploadThreshold = +config.eventUploadThreshold || 30;
    this.eventUploadPeriodMillis = +config.eventUploadPeriodMillis || 30000;
    this.forceHttps = config.forceHttps || false;
    this.trackGclid = config.trackGclid || false;
    this.saveParamsReferrerOncePerSession = config.saveParamsReferrerOncePerSession || false;
    this.deviceIdFromUrlParam = config.deviceIdFromUrlParam || false;
    this.trackRevenuePerProduct = config.trackRevenuePerProduct || false;
    this.preferAnonymousIdForDeviceId = config.preferAnonymousIdForDeviceId || false;
    this.traitsToSetOnce = getTraitsToSetOnce(config);
    this.traitsToIncrement = getTraitsToIncrement(config);
    this.appendFieldsToEventProps = config.appendFieldsToEventProps || false;
    this.unsetParamsReferrerOnNewSession = config.unsetParamsReferrerOnNewSession || false;
    this.trackProductsOnce = config.trackProductsOnce || false;
    this.versionName = config.versionName;
    ({
      shouldApplyDeviceModeTransformation: this.shouldApplyDeviceModeTransformation,
      propagateEventsUntransformedOnError: this.propagateEventsUntransformedOnError,
      destinationId: this.destinationId,
    } = destinationInfo ?? {});
  }

  init() {
    if (this.analytics.loadIntegration) {
      loadNativeSdk(window, document);
    }

    const initOptions = {
      includeUtm: this.trackUtmProperties,
      batchEvents: this.batchEvents,
      eventUploadThreshold: this.eventUploadThreshold,
      eventUploadPeriodMillis: this.eventUploadPeriodMillis,
      forceHttps: this.forceHttps,
      includeGclid: this.trackGclid,
      includeReferrer: this.trackReferrer,
      saveParamsReferrerOncePerSession: this.saveParamsReferrerOncePerSession,
      deviceIdFromUrlParam: this.deviceIdFromUrlParam,
      unsetParamsReferrerOnNewSession: this.unsetParamsReferrerOnNewSession,
      deviceId:
        this.preferAnonymousIdForDeviceId && this.analytics && this.analytics.getAnonymousId(),
    };
    window.amplitude.getInstance().init(this.apiKey, null, initOptions);
    if (this.versionName) {
      window.amplitude.getInstance().setVersionName(this.versionName);
    }
  }

  isLoaded() {
    logger.debug('in Amplitude isLoaded');
    return !!window?.amplitude?.getInstance()?.options;
  }

  isReady() {
    return !!window?.amplitude?.getInstance()?.options;
  }

  identify(htElement) {
    logger.debug('in Amplitude identify');

    this.setDeviceId(htElement);

    // htElement.message.context will always be present as part of identify event payload.
    const { traits } = htElement.message.context;
    const { userId } = htElement.message;

    if (userId) {
      window.amplitude.getInstance().setUserId(userId);
    }

    if (traits) {
      const amplitudeIdentify = new window.amplitude.Identify();
      Object.keys(traits).forEach((trait) => {
        const shouldIncrement = this.traitsToIncrement.includes(trait);
        const shouldSetOnce = this.traitsToSetOnce.includes(trait);

        if (shouldIncrement) {
          amplitudeIdentify.add(trait, traits[trait]);
        }

        if (shouldSetOnce) {
          amplitudeIdentify.setOnce(trait, traits[trait]);
        }

        if (!shouldIncrement && !shouldSetOnce) {
          amplitudeIdentify.set(trait, traits[trait]);
        }
      });
      window.amplitude.identify(amplitudeIdentify);
    }
  }

  track(htElement) {
    logger.debug('in Amplitude track');
    this.setDeviceId(htElement);

    const { properties } = htElement.message;

    // message.properties will always be present as part of track event.
    const { products } = properties;

    const clonedTrackEvent = {};
    Object.assign(clonedTrackEvent, htElement.message);

    // For track products once, we will send the products in a single call.
    if (this.trackProductsOnce) {
      if (products && type(products) === 'array') {
        // track all the products in a single event.
        const allProducts = [];

        const productKeys = Object.keys(products);
        for (let index = 0; index < productKeys.length; index += 1) {
          let product = {};
          product = this.getProductAttributes(products[index]);
          allProducts.push(product);
        }

        clonedTrackEvent.properties.products = allProducts;

        this.logEventAndCorrespondingRevenue(clonedTrackEvent, this.trackRevenuePerProduct); // we do not want to track revenue as a whole if trackRevenuePerProduct is enabled.

        // If trackRevenuePerProduct is enabled, track revenues per product.
        if (this.trackRevenuePerProduct) {
          const trackEventMessage = {};
          Object.assign(trackEventMessage, clonedTrackEvent);
          this.trackingEventAndRevenuePerProduct(trackEventMessage, products, false); // also track revenue only and not event per product.
        }
      } else {
        // track event and revenue as a whole as products array is not available.
        this.logEventAndCorrespondingRevenue(clonedTrackEvent, false);
      }
      return;
    }

    if (products && type(products) === 'array') {
      // track events iterating over product array individually.

      // Log the actuall event without products array. We will subsequently track each product with 'Product Purchased' event.
      delete clonedTrackEvent.properties.products;
      this.logEventAndCorrespondingRevenue(clonedTrackEvent, this.trackRevenuePerProduct);

      const trackEventMessage = {};
      Object.assign(trackEventMessage, clonedTrackEvent);

      // track products and revenue per product basis.
      this.trackingEventAndRevenuePerProduct(trackEventMessage, products, true); // track both event and revenue on per product basis.
    } else {
      // track event and revenue as a whole as no product array is present.
      this.logEventAndCorrespondingRevenue(clonedTrackEvent, false);
    }
  }

  trackingEventAndRevenuePerProduct(trackEventMessage, products, shouldTrackEventPerProduct) {
    const eventMessage = trackEventMessage;
    let { revenueType } = eventMessage.properties;
    const { revenue, revenue_type: revenueTtype } = eventMessage.properties;
    revenueType = revenueType || revenueTtype;
    products.forEach((product) => {
      eventMessage.properties = product;
      eventMessage.event = 'Product Purchased';
      if (this.trackRevenuePerProduct) {
        if (revenueType) {
          eventMessage.properties.revenueType = revenueType;
        }
        if (revenue) {
          eventMessage.properties.revenue = revenue;
        }
        this.trackRevenue(eventMessage);
      }
      if (shouldTrackEventPerProduct) {
        this.logEventAndCorrespondingRevenue(eventMessage, true);
      }
    });
  }

  // Always to be called for general and top level events (and not product level)
  // For these events we expect top level revenue property.
  logEventAndCorrespondingRevenue(rudderMessage, dontTrackRevenue) {
    const { properties, event } = rudderMessage;

    window.amplitude.getInstance().logEvent(event, properties);
    if (properties.revenue && !dontTrackRevenue) {
      this.trackRevenue(rudderMessage);
    }
  }

  /**
   * track page events base on destination settings. If more than one settings is enabled, multiple events may be logged for a single page event.
   * For example, if category of a page is present, and both trackAllPages and trackCategorizedPages are enabled, then 2 events will be tracked for
   * a single pageview - 'Loaded a page' and `Viewed page ${category}`.
   *
   * @memberof Amplitude
   */
  page(htElement) {
    logger.debug('in Amplitude page');
    this.setDeviceId(htElement);

    const { properties, name, category, integrations } = htElement.message;
    const useNewPageEventNameFormat = integrations?.AM?.useNewPageEventNameFormat || false;
    // all pages
    if (this.trackAllPages) {
      const event = 'Loaded a page';
      window.amplitude.getInstance().logEvent(event, properties);
    }

    // categorized pages
    if (category && this.trackCategorizedPages) {
      let event;
      if (!useNewPageEventNameFormat) event = `Viewed page ${category}`;
      else event = `Viewed ${category} Page`;
      window.amplitude.getInstance().logEvent(event, properties);
    }

    // named pages
    if (name && this.trackNamedPages) {
      let event;
      if (!useNewPageEventNameFormat) event = `Viewed page ${name}`;
      else event = `Viewed ${name} Page`;
      window.amplitude.getInstance().logEvent(event, properties);
    }
  }

  group(htElement) {
    logger.debug('in Amplitude group');

    this.setDeviceId(htElement);

    const { groupId, traits } = htElement.message;

    const { groupTypeTrait } = this;
    const { groupValueTrait } = this;
    let groupType;
    let groupValue;

    if (groupTypeTrait && groupValueTrait && traits) {
      groupType = traits[groupTypeTrait];
      groupValue = traits[groupValueTrait];
    }

    if (groupType && groupValue) {
      window.amplitude.getInstance().setGroup(groupTypeTrait, groupValueTrait);
    } else if (groupId) {
      // Similar as segment but not sure whether we need it as our cloud mode supports only the above if block
      window.amplitude.getInstance().setGroup('[Rudderstack] Group', groupId);
    }

    // https://developers.amplitude.com/docs/setting-user-properties#setting-group-properties
    // no other api for setting group properties for javascript
  }

  setDeviceId(htElement) {
    const { anonymousId } = htElement.message;
    if (this.preferAnonymousIdForDeviceId && anonymousId) {
      window.amplitude.getInstance().setDeviceId(anonymousId);
    }
  }

  /**
   * Tracks revenue with logRevenueV2() api based on revenue/price present in event payload. If neither of revenue/price present, it returns.
   * The event payload may contain ruddermessage of an original track event payload (from trackEvent method) or it is derived from a product
   * array (from trackingRevenuePerProduct) in an e-comm event.
   *
   * @param {*} rudderMessage
   * @returns
   * @memberof Amplitude
   */
  trackRevenue(rudderMessage) {
    const mapRevenueType = {
      'order completed': 'Purchase',
      'completed order': 'Purchase',
      'product purchased': 'Purchase',
    };

    const { properties, event } = rudderMessage;
    let { price, productId, quantity } = properties;
    const { revenue, product_id: pId, revenue_type: revenueTtype } = properties;
    const revenueType =
      properties.revenueType || revenueTtype || mapRevenueType[event.toLowerCase()];

    productId = productId || pId;

    // If neither revenue nor price is present, then return
    // else send price and quantity from properties to amplitude
    // If price not present set price as revenue's value and force quantity to be 1.
    // Ultimately set quantity to 1 if not already present from above logic.
    if (!revenue && !price) {
      logger.warn('Neither "revenue" nor "price" is available. Hence, not logging revenue');
      return;
    }

    if (!price) {
      price = revenue;
      quantity = 1;
    }
    if (!quantity) {
      quantity = 1;
    }
    const amplitudeRevenue = new window.amplitude.Revenue()
      .setPrice(price)
      .setQuantity(quantity)
      .setEventProperties(properties);
    if (revenueType) {
      amplitudeRevenue.setRevenueType(revenueType);
    }

    if (productId) {
      amplitudeRevenue.setProductId(productId);
    }
    if (amplitudeRevenue._properties) {
      delete amplitudeRevenue._properties.price;
      delete amplitudeRevenue._properties.productId;
      delete amplitudeRevenue._properties.quantity;
    }
    window.amplitude.getInstance().logRevenueV2(amplitudeRevenue);
  }

  getProductAttributes(product) {
    return {
      productId: product.productId || product.product_id,
      sku: product.sku,
      name: product.name,
      price: product.price,
      quantity: product.quantity,
      category: product.category,
    };
  }
}

export default Amplitude;
