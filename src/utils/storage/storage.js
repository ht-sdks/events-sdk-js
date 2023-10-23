/* eslint-disable class-methods-use-this */
import AES from 'crypto-js/aes';
import Utf8 from 'crypto-js/enc-utf8';
import get from 'get-value';
import logger from '../logUtil';
import { Cookie } from './cookie';
import { Store } from './store';
import { fromBase64 } from './v3DecryptionUtils';

const defaults = {
  user_storage_key: 'htev_user_id',
  user_storage_trait: 'htev_trait',
  user_storage_anonymousId: 'htev_anonymous_id',
  group_storage_key: 'htev_group_id',
  group_storage_trait: 'htev_group_trait',
  page_storage_init_referrer: 'htev_page_init_referrer',
  page_storage_init_referring_domain: 'htev_page_init_referring_domain',
  session_info: 'htev_session',
  auth_token: 'htev_auth_token',
  prefix: 'HtEvEncrypt:',
  prefixV3: 'HtEv_ENC_v3_', // prefix for v3 encryption
  key: 'HTEV',
};

const rudderDefaults = {
  user_storage_key: 'rl_user_id',
  user_storage_trait: 'rl_trait',
  user_storage_anonymousId: 'rl_anonymous_id',
  group_storage_key: 'rl_group_id',
  group_storage_trait: 'rl_group_trait',
  page_storage_init_referrer: 'rl_page_init_referrer',
  page_storage_init_referring_domain: 'rl_page_init_referring_domain',
  session_info: 'rl_session',
  auth_token: 'rl_auth_token',
  prefix: 'RudderEncrypt:',
  prefixV3: 'RS_ENC_v3_', // prefix for v3 encryption
  key: 'Rudder',
};

const anonymousIdKeyMap = {
  segment: 'ajs_anonymous_id',
  rudder: 'rl_anonymous_id',
};

const userIdKeyMap = {
  segment: 'ajs_user_id',
  rudder: 'rl_user_id',
};

/**
 * Json stringify the given value
 * @param {*} value
 */
function stringify(value) {
  return JSON.stringify(value);
}

/**
 * JSON parse the value
 * @param {*} value
 */
function parse(value) {
  // if not parsable, return as is without json parse
  try {
    return value ? JSON.parse(value) : null;
  } catch (e) {
    logger.error(e);
    return value || null;
  }
}

/**
 * trim using regex for browser polyfill
 * @param {*} value
 */
function trim(value) {
  return value.replace(/^\s+|\s+$/gm, '');
}

/**
 * decrypt value
 * @param {*} value
 */
function decryptValue(value) {
  if (!value || typeof value !== 'string' || trim(value) === '') {
    return value;
  }
  if (value.substring(0, defaults.prefix.length) === defaults.prefix) {
    return AES.decrypt(value.substring(defaults.prefix.length), defaults.key).toString(Utf8);
  }

  // Try if it is v3 encrypted value
  if (value.substring(0, defaults.prefixV3.length) === defaults.prefixV3) {
    return fromBase64(value.substring(defaults.prefixV3.length));
  }
  return value;
}

/**
 * decrypt value originally made by rudder
 * @param {*} value
 */
function decryptRudderValue(value) {
  if (!value || typeof value !== 'string' || trim(value) === '') {
    return value;
  }
  if (value.substring(0, rudderDefaults.prefix.length) === rudderDefaults.prefix) {
    return AES.decrypt(value.substring(rudderDefaults.prefix.length), rudderDefaults.key).toString(
      Utf8,
    );
  }

  // Try if it is v3 encrypted value
  if (value.substring(0, rudderDefaults.prefixV3.length) === rudderDefaults.prefixV3) {
    return fromBase64(value.substring(rudderDefaults.prefixV3.length));
  }
  return value;
}

/**
 * AES encrypt value with constant prefix
 * @param {*} value
 */
function encryptValue(value) {
  if (trim(value) === '') {
    return value;
  }
  const prefixedVal = `${defaults.prefix}${AES.encrypt(value, defaults.key).toString()}`;

  return prefixedVal;
}

/**
 * An object that handles persisting key-val from Analytics
 */
class Storage {
  constructor() {
    // First try setting the storage to localstorage else cookie

    // localStorage is enabled.
    // if (Store.enabled) {
    //   this.storage = Store;
    //   return;
    // }

    // if (Cookie.isSupportAvailable) {
    //   this.storage = Cookie;
    //   return;
    // }

    if (!this.storage) {
      logger.error('No storage is available :: initializing the SDK without storage');
    }
  }

  options(options = {}) {
    this.storage.options(options);
  }

  /**
   *
   * @param {*} key
   * @param {*} value
   */
  setItem(key, value) {
    this.storage.set(key, encryptValue(stringify(value)));
  }

  /**
   *
   * @param {*} key
   * @param {*} value
   */
  setStringItem(key, value) {
    if (typeof value !== 'string') {
      logger.error(`[Storage] ${key} should be string`);
      return;
    }
    this.setItem(key, value);
  }

  /**
   *
   * @param {*} value
   */
  setUserId(value) {
    this.setStringItem(defaults.user_storage_key, value);
  }

  /**
   *
   * @param {*} value
   */
  setUserTraits(value) {
    this.setItem(defaults.user_storage_trait, value);
  }

  /**
   *
   * @param {*} value
   */
  setGroupId(value) {
    this.setStringItem(defaults.group_storage_key, value);
  }

  /**
   *
   * @param {*} value
   */
  setGroupTraits(value) {
    this.setItem(defaults.group_storage_trait, value);
  }

  /**
   *
   * @param {*} value
   */
  setAnonymousId(value) {
    this.setStringItem(defaults.user_storage_anonymousId, value);
  }

  /**
   * @param {*} value
   */
  setInitialReferrer(value) {
    this.setItem(defaults.page_storage_init_referrer, value);
  }

  /**
   * @param {*} value
   */
  setInitialReferringDomain(value) {
    this.setItem(defaults.page_storage_init_referring_domain, value);
  }

  /**
   * Set session information
   * @param {*} value
   */
  setSessionInfo(value) {
    this.setItem(defaults.session_info, value);
  }

  /**
   * Set auth token for CT server
   * @param {*} value
   */
  setAuthToken(value) {
    this.setItem(defaults.auth_token, value);
  }

  /**
   *
   * @param {*} key
   */
  getItem(key) {
    return parse(decryptValue(this.storage.get(key)));
  }

  /**
   * get stored user id
   *
   * @param {{autoCapture?: {enabled?: boolean, source?: "segment" | "rudder" | "auto"}}} userIdOptions - optional
   *
   * @returns string
   *
   * If htev_user_id is already in storage, always return that.
   * If htev_user_id is undefined, try to import an external value based on the userIdOptions.
   * In all cases, the function returns undefined if no user id is found.
   */
  getUserId(userIdOptions) {
    const htUserId = this.getItem(defaults.user_storage_key);
    if (htUserId) {
      return htUserId;
    }
    return this.fetchExternalValue(userIdOptions, userIdKeyMap);
  }

  /**
   * get the stored user traits
   */
  getUserTraits() {
    return this.getItem(defaults.user_storage_trait);
  }

  /**
   * get the stored userId
   */
  getGroupId() {
    return this.getItem(defaults.group_storage_key);
  }

  /**
   * get the stored user traits
   */
  getGroupTraits() {
    return this.getItem(defaults.group_storage_trait);
  }

  /**
   * get external value based on a keyMap
   *
   * @param {{autoCapture?: {enabled?: boolean, source?: "segment" | "rudder" | "auto"}}} options
   * @param {{segment: string, rudder: string}} keyMap
   *
   * @returns string
   */
  fetchExternalValue(options, keyMap) {
    let value;
    // try-catch this in case decrypting values fails on rudder sources
    try {
      // validate the provided options argument
      const source = get(options, 'autoCapture.source');
      if (typeof source !== 'string' || get(options, 'autoCapture.enabled') !== true) {
        return value;
      }
      // fetch the value from one external source or try to import from all of them
      if (source === 'auto') {
        const sourceKeys = Object.keys(keyMap);
        while (!value && sourceKeys.length > 0) {
          value = this.fetchExternalValueFromSource(keyMap, sourceKeys.pop());
        }
      } else {
        value = this.fetchExternalValueFromSource(keyMap, source);
      }
      if (value) return value;
    } catch (err) {
      // console.error('Problem with fetching external value', err.toString());
    }
    return value;
  }

  /**
   * @param {{segment: string, rudder: string}} keyMap
   * @param {('segment'|'rudder')} source
   *
   * @returns string
   */
  fetchExternalValueFromSource(keyMap, source) {
    let value;
    let encrypted;
    const key = source.toLowerCase();
    if (!Object.keys(keyMap).includes(key)) {
      return value;
    }
    switch (key) {
      case 'segment':
        // Segment prefers localstorage, so check there first
        if (Store.enabled) {
          value = Store.get(keyMap.segment);
        }
        // then try cookie
        if (!value && Cookie.isSupportAvailable) {
          value = Cookie.get(keyMap.segment);
        }
        return value;

      case 'rudder':
      case 'rudderstack':
        // Rudder prefers cookies, so check there first
        if (Cookie.isSupportAvailable) {
          encrypted = Cookie.get(keyMap.rudder);
        }
        // then try localStorage
        if (!encrypted && Store.enabled) {
          encrypted = Store.get(keyMap.rudder);
        }
        // Rudder always JSON stringifies and then encrypts stored values
        return parse(decryptRudderValue(encrypted));

      default:
        return value;
    }
  }

  /**
   * Function to fetch anonymousId from external source
   * @param {('segment'|'rudder')} source - source of the anonymousId
   * @returns string | undefined
   */
  fetchExternalAnonymousId(source) {
    return this.fetchExternalValueFromSource(anonymousIdKeyMap, source);
  }

  /**
   * get stored anonymous id
   *
   * @param {{autoCapture?: {enabled?: boolean, source?: "segment" | "rudder" | "auto"}}} anonymousIdOptions - optional
   *
   * @returns string
   *
   * If htev_anonymous_id is already in storage, always return that.
   * If htev_anonymous_id is undefined, try to import an external value based on the anonymousIdOptions.
   * In all cases, the function returns undefined if no anonymous id is found.
   */
  getAnonymousId(anonymousIdOptions) {
    // check for existing anonymous id and early return if found
    const htAnonymousId = parse(decryptValue(this.storage.get(defaults.user_storage_anonymousId)));
    if (htAnonymousId) {
      return htAnonymousId;
    }
    return this.fetchExternalValue(anonymousIdOptions, anonymousIdKeyMap);
  }

  /**
   * get stored initial referrer
   */
  getInitialReferrer() {
    return this.getItem(defaults.page_storage_init_referrer);
  }

  /**
   * get stored initial referring domain
   */
  getInitialReferringDomain() {
    return this.getItem(defaults.page_storage_init_referring_domain);
  }

  /**
   * get the stored session info
   */
  getSessionInfo() {
    return this.getItem(defaults.session_info);
  }

  /**
   * get the auth token
   */
  getAuthToken() {
    return this.getItem(defaults.auth_token);
  }

  /**
   *
   * @param {*} key
   */
  removeItem(key) {
    return this.storage.remove(key);
  }

  removeSessionInfo() {
    this.removeItem(defaults.session_info);
  }

  /**
   * remove stored keys
   */
  clear(flag) {
    this.storage.remove(defaults.user_storage_key);
    this.storage.remove(defaults.user_storage_trait);
    this.storage.remove(defaults.group_storage_key);
    this.storage.remove(defaults.group_storage_trait);
    this.storage.remove(defaults.auth_token);
    if (flag) {
      this.storage.remove(defaults.user_storage_anonymousId);
    }
  }
}

export { Storage };
