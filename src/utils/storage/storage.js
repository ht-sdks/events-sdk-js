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
    // First try setting the storage to cookie else to localstorage

    if (Cookie.isSupportAvailable) {
      this.storage = Cookie;
      return;
    }

    // localStorage is enabled.
    if (Store.enabled) {
      this.storage = Store;
    }

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
   * get the stored userId
   */
  getUserId() {
    return this.getItem(defaults.user_storage_key);
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
   * Function to fetch anonymousId from external source
   * @param {('segment'|'rudder')} source - source of the anonymousId
   * @returns string | undefined
   */
  fetchExternalAnonymousId(source) {
    let anonId;
    let encrypted;
    const key = source.toLowerCase();
    if (!Object.keys(anonymousIdKeyMap).includes(key)) {
      return anonId;
    }
    switch (key) {
      case 'segment':
        /**
         * First check the local storage for anonymousId
         * Ref: https://segment.com/docs/connections/sources/catalog/libraries/website/javascript/#identify
         */
        if (Store.enabled) {
          anonId = Store.get(anonymousIdKeyMap.segment);
        }
        // If anonymousId is not present in local storage and check cookie support exists
        // fetch it from cookie
        if (!anonId && Cookie.isSupportAvailable) {
          anonId = Cookie.get(anonymousIdKeyMap.segment);
        }
        return anonId;

      case 'rudder':
      case 'rudderstack':
        // Rudder prefers cookies, so check there first
        if (Cookie.isSupportAvailable) {
          encrypted = Cookie.get(anonymousIdKeyMap.rudder);
        }
        // Rudder falls back to localStorage
        if (!encrypted && Store.enabled) {
          encrypted = Store.get(anonymousIdKeyMap.rudder);
        }
        // Rudder always JSON stringifies and then encrypts stored values
        return parse(decryptRudderValue(encrypted));

      default:
        return anonId;
    }
  }

  /**
   * get stored anonymous id
   *
   * @param {{autoCapture?: {enabled?: boolean, source?: "segment" | "rudder"}}} anonymousIdOptions - optional
   *
   * @returns string
   *
   * If anonymousIdOptions is undefined, returns htev_anonymous_id, if present else undefined.
   * If anonymousIdOptions is present, returns htev_anonymous_id, if present else checks external provided source.
   * In all cases, the function returns undefined if no anonymous id is found.
   */
  getAnonymousId(anonymousIdOptions) {
    // fetch the rl_anonymous_id from storage
    const rlAnonymousId = parse(decryptValue(this.storage.get(defaults.user_storage_anonymousId)));
    /**
     * If HtEv's anonymous ID is available, return from here.
     *
     * The user, while migrating from a different analytics SDK,
     * will only need to auto-capture the anonymous ID when the RS SDK
     * loads for the first time.
     *
     * The captured anonymous ID would be available in RS's persistent storage
     * for all the subsequent SDK runs.
     * So, instead of always grabbing the ID from the migration source when
     * the options are specified, it is first checked in the RS's persistent storage.
     *
     * Moreover, the user can also clear the anonymous ID from the storage via
     * the 'reset' API, which renders the migration source's data useless.
     */
    if (rlAnonymousId) {
      return rlAnonymousId;
    }

    // try-catch this in case decrypting values fails on rudder sources
    try {
      // validate the provided anonymousIdOptions argument
      const source = get(anonymousIdOptions, 'autoCapture.source');
      if (get(anonymousIdOptions, 'autoCapture.enabled') === true && typeof source === 'string') {
        // fetch the anonymousId from the external source
        // ex - segment
        const anonId = this.fetchExternalAnonymousId(source);
        if (anonId) return anonId; // return anonymousId if present
      }
    } catch (err) {
      console.error('Problem with external anonymousId', err.toString());
    }

    return rlAnonymousId; // return undefined
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
