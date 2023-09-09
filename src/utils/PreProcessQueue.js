/* eslint-disable consistent-return */

import Queue from '@segment/localstorage-retry';
import HtElement from './HtElement';

/**
 * Keeping maxAttempts to Infinity to retry cloud mode events and throw an error until processQueueElements flag is not set to true
 */
const queueOptions = {
  maxRetryDelay: 360000,
  minRetryDelay: 1000,
  backoffFactor: 2,
  maxAttempts: Infinity,
};

class PreProcessQueue {
  constructor() {
    this.callback = undefined;
    this.processQueueElements = false;
  }

  init(options, callback) {
    if (options) {
      // TODO: add checks for value - has to be +ve?
      Object.assign(queueOptions, options);
    }
    if (callback) {
      this.callback = callback;
    }
    this.payloadQueue = new Queue('rs_events', queueOptions, (item, done) => {
      this.processQueueElement(item.type, item.htElement, (err, res) => {
        if (err) {
          return done(err);
        }
        done(null, res);
      });
    });
    this.payloadQueue.start();
  }

  activateProcessor() {
    // An indicator to process elements in queue
    this.processQueueElements = true;
  }

  processQueueElement(type, htElement, queueFn) {
    try {
      if (this.processQueueElements) {
        Object.setPrototypeOf(htElement, HtElement.prototype);
        this.callback(type, htElement);
        queueFn(null);
      } else {
        queueFn(new Error('The queue elements are not ready to be processed yet'));
      }
    } catch (error) {
      queueFn(error);
    }
  }

  enqueue(type, htElement) {
    // add items to the queue
    this.payloadQueue.addItem({ type, htElement });
  }
}

export default PreProcessQueue;
