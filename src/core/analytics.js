/* eslint-disable prefer-rest-params */
/* eslint-disable no-use-before-define */
/* eslint-disable new-cap */
/* eslint-disable func-names */
/* eslint-disable eqeqeq */
/* eslint-disable no-prototype-builtins */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-restricted-syntax */
/* eslint-disable guard-for-in */
/* eslint-disable no-sequences */
/* eslint-disable no-multi-assign */
/* eslint-disable no-unused-expressions */
/* eslint-disable import/extensions */
/* eslint-disable no-param-reassign */
/* eslint-disable sonarjs/cognitive-complexity */
import Emitter from 'component-emitter';
import * as R from 'ramda';
import {
  getJSONTrimmed,
  generateUUID,
  getUserProvidedConfigUrl,
  findAllEnabledDestinations,
  transformToRudderNames,
  transformToServerNames,
  checkReservedKeywords,
  getConfigUrl,
  getSDKUrlInfo,
  commonNames,
  getStringId,
  resolveDataPlaneUrl,
  fetchCookieConsentState,
  parseQueryString,
} from '../utils/utils';
import { getReferrer, getReferringDomain, getDefaultPageProperties } from '../utils/pageProperties';
import { handleError } from '../utils/errorHandler';
import {
  MAX_WAIT_FOR_INTEGRATION_LOAD,
  INTEGRATION_LOAD_CHECK_INTERVAL,
  DEST_SDK_BASE_URL,
  INTG_SUFFIX,
  POLYFILL_URL,
  SAMESITE_COOKIE_OPTS,
  UA_CH_LEVELS,
  DEFAULT_INTEGRATIONS_CONFIG,
  DEFAULT_DATA_PLANE_EVENTS_BUFFER_TIMEOUT_MS,
} from '../utils/constants';
import HtElementBuilder from '../utils/HtElementBuilder';
import Storage from '../utils/storage';
import { EventRepository } from '../utils/EventRepository';
import PreProcessQueue from '../utils/PreProcessQueue';
import logger from '../utils/logUtil';
import ScriptLoader from '../utils/ScriptLoader';
import parseLinker from '../utils/linker';
import { configToIntNames } from '../utils/config_to_integration_names';
import CookieConsentFactory from '../features/core/cookieConsent/CookieConsentFactory';
import { UserSession } from '../features/core/session';
import { mergeContext, mergeTopLevelElementsMutator } from '../utils/eventProcessorUtils';
import {
  getMergedClientSuppliedIntegrations,
  constructMessageIntegrationsObj,
} from '../utils/IntegrationsData';
import { getIntegrationsCDNPath } from '../utils/cdnPaths';
import { ErrorReportingService } from '../features/core/metrics/errorReporting/ErrorReportingService';
import { getUserAgentClientHint } from '../utils/clientHint';
import { DeviceModeTransformations } from '../features/core/deviceModeTransformation/transformationHandler';
import { isNonEmptyObject } from '../utils/ObjectUtils';

/**
 * class responsible for handling core
 * event tracking functionalities
 */
class Analytics {
  /**
   * Creates an instance of Analytics.
   * @memberof Analytics
   */
  constructor() {
    this.initialized = false;
    this.clientIntegrations = [];
    this.loadOnlyIntegrations = {};
    this.clientIntegrationObjects = undefined;
    this.successfullyLoadedIntegration = [];
    this.failedToBeLoadedIntegration = [];
    this.toBeProcessedArray = [];
    this.toBeProcessedByIntegrationArray = [];
    this.storage = Storage;
    this.eventRepository = EventRepository;
    this.preProcessQueue = new PreProcessQueue();
    this.sendAdblockPage = false;
    this.sendAdblockPageOptions = {};
    this.clientSuppliedCallbacks = {};
    // Array to store the callback functions registered in the ready API
    this.readyCallbacks = [];
    this.methodToCallbackMapping = {
      syncPixel: 'syncPixelCallback',
    };
    this.loaded = false;
    this.loadIntegration = true;
    this.bufferDataPlaneEventsUntilReady = false;
    this.dataPlaneEventsBufferTimeout = DEFAULT_DATA_PLANE_EVENTS_BUFFER_TIMEOUT_MS;
    this.integrationsData = {};
    this.dynamicallyLoadedIntegrations = {};
    this.destSDKBaseURL = DEST_SDK_BASE_URL;
    this.cookieConsentOptions = {};
    this.logLevel = undefined;
    // flag to indicate client integrations` ready status
    this.clientIntegrationsReady = false;
    this.uSession = UserSession;
    this.version = '__PACKAGE_VERSION__';
    this.lockIntegrationsVersion = false;
    this.errorReporting = new ErrorReportingService(logger);
    this.deniedConsentIds = [];
    this.transformationHandler = DeviceModeTransformations;
  }

  /**
   * initialize the user after load config
   * @param {* | undefined} [anonymousIdOptions]
   * @param {* | undefined} [userIdOptions]
   */
  initializeUser(anonymousIdOptions, userIdOptions) {
    // By default, auto import other userID on SDK.load()
    this.userId =
      this.storage.getUserId(userIdOptions || { autoCapture: { enabled: true, source: 'auto' } }) ||
      '';
    // save once for storing older values to encrypted
    this.storage.setUserId(this.userId);

    this.userTraits = this.storage.getUserTraits() || {};
    this.storage.setUserTraits(this.userTraits);

    this.groupId = this.storage.getGroupId() || '';
    this.storage.setGroupId(this.groupId);

    this.groupTraits = this.storage.getGroupTraits() || {};
    this.storage.setGroupTraits(this.groupTraits);

    // By default, auto import other anonymous IDs on SDK.load()
    this.anonymousId = this.getAnonymousId(
      anonymousIdOptions || { autoCapture: { enabled: true, source: 'auto' } },
    );
    this.storage.setAnonymousId(this.anonymousId);
  }

  setInitialPageProperties() {
    if (
      this.storage.getInitialReferrer() == null &&
      this.storage.getInitialReferringDomain() == null
    ) {
      const initialReferrer = getReferrer();
      this.storage.setInitialReferrer(initialReferrer);
      this.storage.setInitialReferringDomain(getReferringDomain(initialReferrer));
    }
  }

  allModulesInitialized(time = 0) {
    return new Promise((resolve) => {
      if (
        this.clientIntegrations.every(
          (intg) =>
            this.dynamicallyLoadedIntegrations[`${configToIntNames[intg.name]}${INTG_SUFFIX}`] !=
            undefined,
        )
      ) {
        // logger.debug(
        //   "All integrations loaded dynamically",
        //   this.dynamicallyLoadedIntegrations
        // );
        resolve(this);
      } else if (time >= 2 * MAX_WAIT_FOR_INTEGRATION_LOAD) {
        // logger.debug("Max wait for dynamically loaded integrations over")
        resolve(this);
      } else {
        this.pause(INTEGRATION_LOAD_CHECK_INTERVAL).then(() =>
          // logger.debug("Check if all integration SDKs are loaded after pause")
          this.allModulesInitialized(time + INTEGRATION_LOAD_CHECK_INTERVAL).then(resolve),
        );
      }
    });
  }

  /**
   * Function to execute the ready method callbacks
   * @param {Analytics} self
   */
  executeReadyCallback() {
    this.readyCallbacks.forEach((callback) => callback());
  }

  /**
   * A function to validate integration SDK is available in window
   * and integration constructor is not undefined
   * @param {string} pluginName
   * @param {string} modName
   * @returns boolean
   */
  integrationSDKLoaded(pluginName, modName) {
    return (
      window[pluginName] &&
      window[pluginName][modName] &&
      window[pluginName][modName].prototype &&
      typeof window[pluginName][modName].prototype.constructor !== 'undefined'
    );
  }

  /**
   * Process the response from control plane and
   * call initialize for integrations
   *
   * @param {*} status
   * @param {*} responseVal
   * @memberof Analytics
   */
  processResponse(status, responseVal) {
    try {
      // logger.debug(`===in process response=== ${status}`);

      let response = responseVal;
      try {
        if (typeof responseVal === 'string') {
          response = JSON.parse(responseVal);
        }

        // Do not proceed if the ultimate response value is not an object
        if (!response || typeof response !== 'object' || Array.isArray(response)) {
          logger.error('Invalid source configuration');
          return;
        }
      } catch (err) {
        handleError(err);
        return;
      }

      // Initialise error reporting provider if set in source config
      try {
        this.errorReporting.init(response.source.config, response.source.id);
      } catch (err) {
        handleError(err);
      }

      // determine the dataPlaneUrl
      this.serverUrl = resolveDataPlaneUrl(response, this.serverUrl, this.options);

      // Initialize event repository
      this.eventRepository.initialize(this.writeKey, this.serverUrl, this.options);
      this.loaded = true;
      // Initialize transformation handler once we determine the dataPlaneUrl
      this.transformationHandler.init(this.writeKey, this.serverUrl, this.storage.getAuthToken());

      // Execute onLoaded callback if provided in load options
      if (this.options && typeof this.options.onLoaded === 'function') {
        this.options.onLoaded(this);
      }

      // Execute any pending buffered requests
      // (needed if the load call was not previously buffered)
      processDataInAnalyticsArray(this);

      response.source.destinations.forEach(function (destination) {
        // logger.debug(
        //   `Destination ${index} Enabled? ${destination.enabled} Type: ${destination.destinationDefinition.name} Use Native SDK? true`
        // );
        if (destination.enabled) {
          this.clientIntegrations.push({
            name: destination.destinationDefinition.name,
            config: destination.config,
            destinationInfo: {
              shouldApplyDeviceModeTransformation:
                destination.shouldApplyDeviceModeTransformation || false,
              propagateEventsUntransformedOnError:
                destination.propagateEventsUntransformedOnError || false,
              destinationId: destination.id,
            },
          });
        }
      }, this);

      // intersection of config-plane native sdk destinations with sdk load time destination list
      this.clientIntegrations = findAllEnabledDestinations(
        this.loadOnlyIntegrations,
        this.clientIntegrations,
      );
      // Check if cookie consent manager is being set through load options
      if (Object.keys(this.cookieConsentOptions).length > 0) {
        // Call the cookie consent factory to initialise and return the type of cookie
        // consent being set. For now we only support OneTrust.
        try {
          const cookieConsent = CookieConsentFactory.initialize(this.cookieConsentOptions);
          // Fetch denied consent group Ids and pass it to cloud mode
          this.deniedConsentIds = cookieConsent && cookieConsent.getDeniedList();
          // If cookie consent object is return we filter according to consents given by user
          // else we do not consider any filtering for cookie consent.
          this.clientIntegrations = this.clientIntegrations.filter(
            (intg) =>
              !cookieConsent || // check if cookieconsent object is present and then do filtering
              (cookieConsent && cookieConsent.isEnabled(intg.config)),
          );
        } catch (e) {
          handleError(e);
        }
      }

      // filter destination that doesn't have mapping config-->Integration names
      this.clientIntegrations = this.clientIntegrations.filter((intg) => {
        if (configToIntNames[intg.name]) {
          return true;
        }
        logger.error(`[Analytics] Integration:: ${intg.name} not available for initialization`);
        return false;
      });

      let suffix = ''; // default suffix

      // Get the CDN base URL, if staging url
      const { isStaging } = getSDKUrlInfo();
      if (isStaging) {
        suffix = '-staging'; // stagging suffix
      }

      if (this.bufferDataPlaneEventsUntilReady) {
        // Fallback logic to process buffered cloud mode events if integrations are failed to load in given interval
        setTimeout(() => {
          this.processBufferedCloudModeEvents();
        }, this.dataPlaneEventsBufferTimeout);
      }

      this.errorReporting.leaveBreadcrumb('Starting device-mode initialization');
      // logger.debug("this.clientIntegrations: ", this.clientIntegrations)
      // Load all the client integrations dynamically
      this.clientIntegrations.forEach((intg) => {
        const modName = configToIntNames[intg.name]; // script URL can be constructed from this
        const pluginName = `${modName}${INTG_SUFFIX}`; // this is the name of the object loaded on the window
        const modURL = `${this.destSDKBaseURL}/${modName}${suffix}.min.js`;

        if (!window.hasOwnProperty(pluginName)) {
          ScriptLoader(pluginName, modURL, { isNonNativeSDK: true });
        }

        const self = this;
        const interval = setInterval(() => {
          if (self.integrationSDKLoaded(pluginName, modName)) {
            const intMod = window[pluginName];
            clearInterval(interval);

            // logger.debug(pluginName, " dynamically loaded integration SDK");

            let intgInstance;
            try {
              const msg = `[Analytics] processResponse :: trying to initialize integration name:: ${pluginName}`;
              // logger.debug(msg);
              this.errorReporting.leaveBreadcrumb(msg);
              intgInstance = new intMod[modName](intg.config, self, intg.destinationInfo);
              intgInstance.init();

              // logger.debug(pluginName, " initializing destination");

              self.isInitialized(intgInstance).then(() => {
                // logger.debug(pluginName, " module init sequence complete");
                self.dynamicallyLoadedIntegrations[pluginName] = intMod[modName];
              });
            } catch (e) {
              const message = `[Analytics] 'integration.init()' failed :: ${pluginName} :: ${e.message}`;
              handleError(e, message);
              self.failedToBeLoadedIntegration.push(intgInstance);
            }
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
        }, MAX_WAIT_FOR_INTEGRATION_LOAD);
      });

      const self = this;
      this.allModulesInitialized().then(() => {
        if (!self.clientIntegrations || self.clientIntegrations.length === 0) {
          // If no integrations are there to be loaded
          // set clientIntegrationsReady to be true
          this.clientIntegrationsReady = true;
          // Execute the callbacks if any
          this.executeReadyCallback();
          this.toBeProcessedByIntegrationArray = [];
          return;
        }

        self.replayEvents(self);
      });
    } catch (error) {
      handleError(error);
    }
  }

  /**
   * A function to send single event to a destination
   * @param {instance} destination
   * @param {Object} htElement
   * @param {String} methodName
   */
  sendDataToDestination(destination, htElement, methodName) {
    try {
      if (destination[methodName]) {
        const clonedHtElement = R.clone(htElement);
        destination[methodName](clonedHtElement);
      }
    } catch (err) {
      const message = `[sendToNative]:: [Destination: ${destination.name}]:: `;
      handleError(err, message);
    }
  }

  /**
   * A function that gets the transformed event and
   * depending on the response either send the transformed/untransformed event to destination or just log error.
   * @param {Array} destWithTransformation   List of device mode destination that has transformation connected
   * @param {Object} htElement           Rudder event
   * @param {string} methodName              Type of event page/track/identify etc.
   */
  sendTransformedDataToDestination(destWithTransformation, htElement, methodName) {
    try {
      // convert integrations object to server identified names, kind of hack now!
      transformToServerNames(htElement.message.integrations);
      const destinationIds = destWithTransformation.map((e) => e.destinationId);
      // Process Transformation
      this.transformationHandler.enqueue(
        htElement,
        destinationIds,
        ({ status, transformedPayload, errorMessage }) => {
          destWithTransformation.forEach((intg) => {
            try {
              switch (status) {
                // The transformation request is successful
                case 200: {
                  // filter destination specific transformed payload
                  const destTransformedResult = transformedPayload.find(
                    (e) => e.id === intg.destinationId,
                  );
                  const eventsToSend = [];
                  destTransformedResult?.payload.forEach((tEvent) => {
                    // Transformation successful
                    // event level status is 200
                    if (tEvent.status === '200') {
                      // push transformed event to the queue
                      eventsToSend.push(tEvent);
                    } else {
                      const msgPrefix = `[DMT]:: Event transformation unsuccessful for destination "${intg.name}". Reason: `;

                      let reason = 'Unknown';
                      if (tEvent.status === '410') {
                        reason = 'Transformation is not available';
                      }

                      let action = 'Dropping the event';
                      let logMethod = logger.error;
                      if (intg.propagateEventsUntransformedOnError === true) {
                        action = 'Sending untransformed event to the destination';
                        logMethod = logger.warn;
                        eventsToSend.push({ event: htElement.message });
                      }

                      const logMsg = `${msgPrefix} ${reason}. ${action}.`;
                      logMethod(logMsg);
                    }
                  });
                  // send events to destination
                  eventsToSend?.forEach((tEvent) => {
                    // send only if the event is not null/undefined/empty object
                    if (isNonEmptyObject(tEvent.event)) {
                      this.sendDataToDestination(intg, { message: tEvent.event }, methodName);
                    }
                  });
                  break;
                }
                // Transformation server access denied
                case 404: {
                  logger.warn(
                    `[DMT]:: Transformation server access is denied. The configuration data seems to be out of sync. Sending untransformed event to the destination.`,
                  );
                  // send untransformed event to destination
                  this.sendDataToDestination(intg, htElement, methodName);
                  break;
                }
                // For any other cases
                default: {
                  if (intg.propagateEventsUntransformedOnError === true) {
                    logger.warn(
                      `[DMT]::[Destination: ${intg.name}] :: Transformation request failed with status: ${status} ${errorMessage}. Sending untransformed event.`,
                    );
                    // send untransformed event to destination
                    this.sendDataToDestination(intg, htElement, methodName);
                  } else {
                    logger.error(
                      `[DMT]::[Destination: ${intg.name}] :: Transformation request failed with status: ${status} ${errorMessage}. Dropping the event.`,
                    );
                  }
                  break;
                }
              }
            } catch (e) {
              if (e instanceof Error) {
                e.message = `[DMT]::[Destination:${intg.name}]:: ${e.message}`;
              }
              handleError(e);
            }
          });
        },
      );
    } catch (e) {
      if (e instanceof Error) {
        e.message = `[DMT]:: ${e.message}`;
      }
      handleError(e);
    }
  }

  /**
   * A function to process and send events to device mode destinations
   * @param {instance} destinations
   * @param {Object} htElement
   * @param {String} methodName
   */
  processAndSendEventsToDeviceMode(destinations, htElement, methodName) {
    const destWithoutTransformation = [];
    const destWithTransformation = [];

    // Depending on transformation is connected or not
    // create two sets of destinations
    destinations.forEach((intg) => {
      const sendEvent = !this.IsEventBlackListed(htElement.message.event, intg.name);

      // Block the event if it is blacklisted for the device-mode destination
      if (sendEvent) {
        if (intg.shouldApplyDeviceModeTransformation) {
          destWithTransformation.push(intg);
        } else {
          destWithoutTransformation.push(intg);
        }
      }
    });
    // loop through destinations that doesn't have
    // transformation connected with it and send events
    destWithoutTransformation.forEach((intg) => {
      this.sendDataToDestination(intg, htElement, methodName);
    });

    if (destWithTransformation.length > 0) {
      this.sendTransformedDataToDestination(destWithTransformation, htElement, methodName);
    }
  }

  /**
   *
   * @param {*} type
   * @param {*} htElement
   * Sends cloud mode events to server
   */
  queueEventForDataPlane(type, htElement) {
    // if not specified at event level, All: true is default
    const clientSuppliedIntegrations = htElement.message.integrations || { All: true };
    htElement.message.integrations = getMergedClientSuppliedIntegrations(
      this.integrationsData,
      clientSuppliedIntegrations,
    );
    // self analytics process, send to ht events
    this.eventRepository.enqueue(htElement, type);
  }

  /**
   * Processes the buffered cloud mode events and sends it to server
   */
  processBufferedCloudModeEvents() {
    if (this.bufferDataPlaneEventsUntilReady) {
      this.preProcessQueue.activateProcessor();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  replayEvents(object) {
    // logger.debug(
    //   "===replay events called====",
    //   " successfully loaded count: ",
    //   object.successfullyLoadedIntegration.length,
    //   " failed loaded count: ",
    //   object.failedToBeLoadedIntegration.length
    // );
    this.errorReporting.leaveBreadcrumb(`Started replaying buffered events`);
    // eslint-disable-next-line no-param-reassign
    object.clientIntegrationObjects = [];
    // eslint-disable-next-line no-param-reassign
    object.clientIntegrationObjects = object.successfullyLoadedIntegration;

    // logger.debug(
    //   "==registering after callback===",
    //   " after to be called after count : ",
    //   object.clientIntegrationObjects.length
    // );

    if (object.clientIntegrationObjects.every((intg) => !intg.isReady || intg.isReady())) {
      // Integrations are ready
      // set clientIntegrationsReady to be true
      this.integrationsData = constructMessageIntegrationsObj(
        this.integrationsData,
        object.clientIntegrationObjects,
      );
      object.clientIntegrationsReady = true;
      // Execute the callbacks if any
      object.executeReadyCallback();
    }

    this.processBufferedCloudModeEvents();

    // send the queued events to the fetched integration
    object.toBeProcessedByIntegrationArray.forEach((event) => {
      const methodName = event[0];
      event.shift();

      // convert common names to sdk identified name
      if (Object.keys(event[0].message.integrations).length > 0) {
        transformToRudderNames(event[0].message.integrations);
      }

      // if not specified at event level, All: true is default
      const clientSuppliedIntegrations = event[0].message.integrations;

      // get intersection between config plane native enabled destinations
      // (which were able to successfully load on the page) vs user supplied integrations
      const successfulLoadedIntersectClientSuppliedIntegrations = findAllEnabledDestinations(
        clientSuppliedIntegrations,
        object.clientIntegrationObjects,
      );

      // send to all integrations now from the 'toBeProcessedByIntegrationArray' replay queue
      this.processAndSendEventsToDeviceMode(
        successfulLoadedIntersectClientSuppliedIntegrations,
        event[0],
        methodName,
      );
    });
    object.toBeProcessedByIntegrationArray = [];
  }

  pause(time) {
    return new Promise((resolve) => {
      setTimeout(resolve, time);
    });
  }

  isInitialized(instance, time = 0) {
    return new Promise((resolve) => {
      if (instance.isLoaded()) {
        // logger.debug("===integration loaded successfully====", instance.name)
        this.successfullyLoadedIntegration.push(instance);
        resolve(this);
      } else if (time >= MAX_WAIT_FOR_INTEGRATION_LOAD) {
        // logger.debug("====max wait over====")
        this.failedToBeLoadedIntegration.push(instance);
        resolve(this);
      } else {
        this.pause(INTEGRATION_LOAD_CHECK_INTERVAL).then(() =>
          // logger.debug("====after pause, again checking====")
          this.isInitialized(instance, time + INTEGRATION_LOAD_CHECK_INTERVAL).then(resolve),
        );
      }
    });
  }

  /**
   * Process page params and forward to page call
   *
   * @param {*} category
   * @param {*} name
   * @param {*} properties
   * @param {*} options
   * @param {*} callback
   * @memberof Analytics
   */
  page(category, name, properties, options, callback) {
    this.errorReporting.leaveBreadcrumb(`Page event`);
    if (!this.loaded) {
      this.toBeProcessedArray.push(['page', ...arguments]);
      return;
    }
    if (typeof options === 'function') (callback = options), (options = null);
    if (typeof properties === 'function') (callback = properties), (options = properties = null);
    if (typeof name === 'function') (callback = name), (options = properties = name = null);
    if (typeof category === 'function')
      (callback = category), (options = properties = name = category = null);
    if (typeof category === 'object' && category != null && category != undefined)
      (options = name), (properties = category), (name = category = null);
    if (typeof name === 'object' && name != null && name != undefined)
      (options = properties), (properties = name), (name = null);
    if (typeof category === 'string' && typeof name !== 'string')
      (name = category), (category = null);
    if (this.sendAdblockPage && category != 'EventsJS-Initiated') {
      this.sendSampleRequest();
    }
    let clonedProperties = R.clone(properties);
    const clonedOptions = R.clone(options);

    const htElement = new HtElementBuilder().setType('page').build();
    if (!clonedProperties) {
      clonedProperties = {};
    }
    if (name) {
      htElement.message.name = clonedProperties.name = name;
    }
    if (category) {
      htElement.message.category = clonedProperties.category = category;
    }

    htElement.message.properties = this.getPageProperties(clonedProperties);

    this.processAndSendDataToDestinations('page', htElement, clonedOptions, callback);
  }

  /**
   * Process track params and forward to track call
   *
   * @param {*} event
   * @param {*} properties
   * @param {*} options
   * @param {*} callback
   * @memberof Analytics
   */
  track(event, properties, options, callback) {
    this.errorReporting.leaveBreadcrumb(`Track event`);
    if (!this.loaded) {
      this.toBeProcessedArray.push(['track', ...arguments]);
      return;
    }
    if (typeof options === 'function') (callback = options), (options = null);
    if (typeof properties === 'function')
      (callback = properties), (options = null), (properties = null);

    const clonedProperties = R.clone(properties);
    const clonedOptions = R.clone(options);

    const htElement = new HtElementBuilder().setType('track').build();
    if (event) {
      htElement.setEventName(event);
    }
    htElement.setProperty(clonedProperties || {});

    this.processAndSendDataToDestinations('track', htElement, clonedOptions, callback);
  }

  /**
   * Process identify params and forward to identify  call
   *
   * @param {*} userId
   * @param {*} traits
   * @param {*} options
   * @param {*} callback
   * @memberof Analytics
   */
  identify(userId, traits, options, callback) {
    this.errorReporting.leaveBreadcrumb(`Identify event`);
    if (!this.loaded) {
      this.toBeProcessedArray.push(['identify', ...arguments]);
      return;
    }
    if (typeof options === 'function') (callback = options), (options = null);
    if (typeof traits === 'function') (callback = traits), (options = null), (traits = null);
    if (typeof userId === 'object') (options = traits), (traits = userId), (userId = this.userId);

    const normalisedUserId = getStringId(userId);
    if (normalisedUserId && this.userId && normalisedUserId !== this.userId) {
      this.reset();
    }
    this.userId = normalisedUserId;
    this.storage.setUserId(this.userId);

    const clonedTraits = R.clone(traits);
    const clonedOptions = R.clone(options);

    if (clonedTraits) {
      for (const key in clonedTraits) {
        this.userTraits[key] = clonedTraits[key];
      }
      this.storage.setUserTraits(this.userTraits);
    }
    const htElement = new HtElementBuilder().setType('identify').build();

    this.processAndSendDataToDestinations('identify', htElement, clonedOptions, callback);
  }

  /**
   *
   * @param {*} to
   * @param {*} from
   * @param {*} options
   * @param {*} callback
   */
  alias(to, from, options, callback) {
    this.errorReporting.leaveBreadcrumb(`Alias event`);
    if (!this.loaded) {
      this.toBeProcessedArray.push(['alias', ...arguments]);
      return;
    }
    if (typeof options === 'function') (callback = options), (options = null);
    if (typeof from === 'function') (callback = from), (options = null), (from = null);
    if (typeof to === 'function') (callback = to), (options = null), (from = null), (to = null);
    if (typeof from === 'object') (options = from), (from = null);
    if (typeof to === 'object') (options = to), (from = null), (to = null);

    const htElement = new HtElementBuilder().setType('alias').build();

    htElement.message.previousId =
      getStringId(from) || (this.userId ? this.userId : this.getAnonymousId());
    htElement.message.userId = getStringId(to);
    const clonedOptions = R.clone(options);

    this.processAndSendDataToDestinations('alias', htElement, clonedOptions, callback);
  }

  /**
   *
   * @param {*} to
   * @param {*} from
   * @param {*} options
   * @param {*} callback
   */
  group(groupId, traits, options, callback) {
    this.errorReporting.leaveBreadcrumb(`Group event`);
    if (!this.loaded) {
      this.toBeProcessedArray.push(['group', ...arguments]);
      return;
    }
    if (arguments.length === 0) return;

    if (typeof options === 'function') (callback = options), (options = null);
    if (typeof traits === 'function') (callback = traits), (options = null), (traits = null);
    if (typeof groupId === 'object')
      (options = traits), (traits = groupId), (groupId = this.groupId);
    if (typeof groupId === 'function')
      (callback = groupId), (options = null), (traits = null), (groupId = this.groupId);

    this.groupId = getStringId(groupId);
    this.storage.setGroupId(this.groupId);
    const clonedTraits = R.clone(traits);
    const clonedOptions = R.clone(options);

    const htElement = new HtElementBuilder().setType('group').build();

    if (clonedTraits) {
      for (const key in clonedTraits) {
        this.groupTraits[key] = clonedTraits[key];
      }
    } else {
      this.groupTraits = {};
    }
    this.storage.setGroupTraits(this.groupTraits);

    this.processAndSendDataToDestinations('group', htElement, clonedOptions, callback);
  }

  IsEventBlackListed(eventName, intgName) {
    if (!eventName || !(typeof eventName === 'string')) {
      return false;
    }
    const sdkIntgName = commonNames[intgName];
    const intg = this.clientIntegrations.find(
      (clientIntegration) => clientIntegration.name === sdkIntgName,
    );

    const { blacklistedEvents, whitelistedEvents, eventFilteringOption } = intg.config;

    if (!eventFilteringOption) {
      return false;
    }

    const formattedEventName = eventName.trim().toUpperCase();
    switch (eventFilteringOption) {
      // disabled filtering
      case 'disable':
        return false;
      // Blacklist is chosen for filtering events
      case 'blacklistedEvents':
        if (Array.isArray(blacklistedEvents)) {
          return blacklistedEvents.some(
            (eventObj) => eventObj.eventName.trim().toUpperCase() === formattedEventName,
          );
        }
        return false;

      // Whitelist is chosen for filtering events
      case 'whitelistedEvents':
        if (Array.isArray(whitelistedEvents)) {
          return !whitelistedEvents.some(
            (eventObj) => eventObj.eventName.trim().toUpperCase() === formattedEventName,
          );
        }
        return true;

      default:
        return false;
    }
  }

  /**
   * A function to determine whether SDK should use the integration option provided in load call
   * @returns boolean
   */
  shouldUseGlobalIntegrationsConfigInEvents() {
    return (
      this.useGlobalIntegrationsConfigInEvents &&
      this.loadOnlyIntegrations &&
      Object.keys(this.loadOnlyIntegrations).length > 0
    );
  }

  /**
   * Process and send data to destinations along with ht events BE
   *
   * @param {*} type
   * @param {*} htElement
   * @param {*} callback
   * @memberof Analytics
   */
  processAndSendDataToDestinations(type, htElement, options, callback) {
    try {
      if (!this.anonymousId) {
        this.setAnonymousId();
      }

      // assign page properties to context
      // htElement.message.context.page = getDefaultPageProperties();
      this.errorReporting.leaveBreadcrumb('Started sending data to destinations');
      htElement.message.context.traits = {
        ...this.userTraits,
      };

      // logger.debug("anonymousId: ", this.anonymousId)
      htElement.message.anonymousId = this.anonymousId;
      htElement.message.userId = htElement.message.userId ? htElement.message.userId : this.userId;

      if (type == 'group') {
        if (this.groupId) {
          htElement.message.groupId = this.groupId;
        }
        if (this.groupTraits) {
          htElement.message.traits = {
            ...this.groupTraits,
          };
        }
      }
      // If auto/manual session tracking is enabled sessionId will be sent in the context
      try {
        const { sessionId, sessionStart } = this.uSession.getSessionInfo();
        htElement.message.context.sessionId = sessionId;
        if (sessionStart) htElement.message.context.sessionStart = true;
      } catch (e) {
        handleError(e);
      }
      // If cookie consent is enabled attach the denied consent group Ids to the context
      if (fetchCookieConsentState(this.cookieConsentOptions)) {
        htElement.message.context.consentManagement = {
          deniedConsentIds: this.deniedConsentIds || [],
        };
      }

      this.processOptionsParam(htElement, options);
      // logger.debug(JSON.stringify(htElement))

      // check for reserved keys and log
      checkReservedKeywords(htElement.message, type);

      let clientSuppliedIntegrations = htElement.message.integrations;

      if (clientSuppliedIntegrations) {
        // structure user supplied integrations object to ht events format
        transformToRudderNames(clientSuppliedIntegrations);
      } else if (this.shouldUseGlobalIntegrationsConfigInEvents()) {
        // when useGlobalIntegrationsConfigInEvents load option is set to true and integration object provided in load
        // is not empty use it at event level
        clientSuppliedIntegrations = this.loadOnlyIntegrations;
      } else {
        // if not specified at event level, use default integration option
        clientSuppliedIntegrations = DEFAULT_INTEGRATIONS_CONFIG;
      }

      htElement.message.integrations = clientSuppliedIntegrations;

      try {
        htElement.message.context['ua-ch'] = this.uach;
      } catch (err) {
        handleError(err);
      }

      // config plane native enabled destinations, still not completely loaded
      // in the page, add the events to a queue and process later
      if (!this.clientIntegrationObjects) {
        // logger.debug("pushing in replay queue")
        // new event processing after analytics initialized  but integrations not fetched from BE
        this.toBeProcessedByIntegrationArray.push([type, htElement]);
      } else {
        // get intersection between config plane native enabled destinations
        // (which were able to successfully load on the page) vs user supplied integrations
        const successfulLoadedIntersectClientSuppliedIntegrations = findAllEnabledDestinations(
          clientSuppliedIntegrations,
          this.clientIntegrationObjects,
        );

        // try to first send to all integrations, if list populated from BE
        this.processAndSendEventsToDeviceMode(
          successfulLoadedIntersectClientSuppliedIntegrations,
          htElement,
          type,
        );
      }

      const clonedHtElement = R.clone(htElement);
      // convert integrations object to server identified names, kind of hack now!
      transformToServerNames(clonedHtElement.message.integrations);

      // Holding the cloud mode events based on flag and integrations load check
      const shouldNotBufferDataPlaneEvents =
        !this.bufferDataPlaneEventsUntilReady || this.clientIntegrationObjects;
      if (shouldNotBufferDataPlaneEvents) {
        this.queueEventForDataPlane(type, clonedHtElement);
      } else {
        this.preProcessQueue.enqueue(type, clonedHtElement);
      }

      // logger.debug(`${type} is called `)
      if (callback && typeof callback === 'function') {
        callback(clonedHtElement);
      }
    } catch (error) {
      handleError(error);
    }
  }

  utm(url) {
    const result = {};
    try {
      const urlObj = new URL(url);
      const UTM_PREFIX = 'utm_';
      urlObj.searchParams.forEach((value, sParam) => {
        if (sParam.startsWith(UTM_PREFIX)) {
          let utmParam = sParam.substring(UTM_PREFIX.length);
          // Not sure why we're doing this
          if (utmParam === 'campaign') {
            utmParam = 'name';
          }
          result[utmParam] = value;
        }
      });
    } catch (error) {
      // Do nothing
    }
    return result;
  }

  /**
   * add campaign parsed details under context
   * @param {*} htElement
   */
  addCampaignInfo(htElement) {
    const msgContext = htElement.message.context;
    if (msgContext && typeof msgContext === 'object') {
      htElement.message.context.campaign = this.utm(window.location.href);
    }
  }

  /**
   * process options parameter
   * Apart from top level keys merge everything under context
   * context.page's default properties are overridden by same keys of
   * provided properties in case of page call
   *
   * @param {*} htElement
   * @param {*} options
   * @memberof Analytics
   */
  processOptionsParam(htElement, options) {
    const { type, properties } = htElement.message;

    this.addCampaignInfo(htElement);

    // assign page properties to context.page
    // eslint-disable-next-line unicorn/consistent-destructuring
    htElement.message.context.page = this.getContextPageProperties(
      type === 'page' ? properties : undefined,
    );
    mergeTopLevelElementsMutator(htElement.message, options);
    htElement.message.context = mergeContext(htElement.message, options);
  }

  getPageProperties(properties, options) {
    const defaultPageProperties = getDefaultPageProperties();
    const optionPageProperties = (options && options.page) || {};
    for (const key in defaultPageProperties) {
      if (properties[key] === undefined) {
        properties[key] = optionPageProperties[key] || defaultPageProperties[key];
      }
    }
    return properties;
  }

  // Assign page properties to context.page if the same property is not provided under context.page
  getContextPageProperties(properties) {
    const defaultPageProperties = getDefaultPageProperties();
    const contextPageProperties = {};
    for (const key in defaultPageProperties) {
      contextPageProperties[key] =
        properties && properties[key] ? properties[key] : defaultPageProperties[key];
    }
    return contextPageProperties;
  }

  /**
   * Clear user information
   *
   * @memberof Analytics
   */
  reset(flag) {
    this.errorReporting.leaveBreadcrumb(`reset API :: flag: ${flag}`);

    if (!this.loaded) {
      this.toBeProcessedArray.push(['reset', flag]);
      return;
    }
    if (flag) {
      this.anonymousId = '';
    }
    this.userId = '';
    this.userTraits = {};
    this.groupId = '';
    this.groupTraits = {};
    this.uSession.reset();
    this.storage.clear(flag);
  }

  getAnonymousId(anonymousIdOptions) {
    // if (!this.loaded) return;
    this.anonymousId = this.storage.getAnonymousId(anonymousIdOptions);
    if (!this.anonymousId) {
      this.setAnonymousId();
    }
    return this.anonymousId;
  }

  getUserId() {
    return this.userId;
  }

  getSessionId() {
    return this.uSession.getSessionId();
  }

  getUserTraits() {
    return this.userTraits;
  }

  getGroupId() {
    return this.groupId;
  }

  getGroupTraits() {
    return this.groupTraits;
  }

  /**
   * Sets anonymous id in the following precedence:
   * 1. anonymousId: Id directly provided to the function.
   * 2. rudderAmpLinkerParm: value generated from linker query parm (rudderstack)
   *    using parseLinker util.
   * 3. generateUUID: A new unique id is generated and assigned.
   *
   * @param {string} anonymousId
   * @param {string} rudderAmpLinkerParm
   */
  setAnonymousId(anonymousId, rudderAmpLinkerParm) {
    // if (!this.loaded) return;
    const parsedAnonymousIdObj = rudderAmpLinkerParm ? parseLinker(rudderAmpLinkerParm) : null;
    const parsedAnonymousId = parsedAnonymousIdObj ? parsedAnonymousIdObj.rs_amp_id : null;
    this.anonymousId = anonymousId || parsedAnonymousId || generateUUID();
    this.storage.setAnonymousId(this.anonymousId);
  }

  isValidWriteKey(writeKey) {
    return writeKey && typeof writeKey === 'string' && writeKey.trim().length > 0;
  }

  isValidServerUrl(serverUrl) {
    return serverUrl && typeof serverUrl === 'string' && serverUrl.trim().length > 0;
  }

  isDatasetAvailable() {
    const t = document.createElement('div');
    return t.setAttribute('data-a-b', 'c'), t.dataset ? t.dataset.aB === 'c' : false;
  }

  /**
   * Load after polyfills are loaded
   * @param {*} writeKey
   * @param {*} serverUrl
   * @param {*} options
   * @returns
   */
  loadAfterPolyfill(writeKey, serverUrl, options) {
    if (typeof serverUrl === 'object' && serverUrl !== null) {
      options = serverUrl;
      serverUrl = null;
    }
    if (options && options.logLevel) {
      this.logLevel = options.logLevel;
      logger.setLogLevel(options.logLevel);
    }
    if (!this.isValidWriteKey(writeKey)) {
      throw Error('Unable to load the SDK due to invalid writeKey');
    }
    if (!this.storage || Object.keys(this.storage).length === 0) {
      throw Error('Cannot proceed as no storage is available');
    }
    if (options && options.cookieConsentManager)
      this.cookieConsentOptions = options.cookieConsentManager;

    this.writeKey = writeKey;
    this.serverUrl = serverUrl;
    this.options = options;

    let storageOptions = {};

    if (options && options.setCookieDomain) {
      storageOptions = { ...storageOptions, domain: options.setCookieDomain };
    }

    if (options && typeof options.secureCookie === 'boolean') {
      storageOptions = { ...storageOptions, secure: options.secureCookie };
    }

    if (options && SAMESITE_COOKIE_OPTS.indexOf(options.sameSiteCookie) !== -1) {
      storageOptions = { ...storageOptions, samesite: options.sameSiteCookie };
    }
    this.storage.options(storageOptions);

    const isUACHOptionAvailable =
      options &&
      typeof options.uaChTrackLevel === 'string' &&
      UA_CH_LEVELS.includes(options.uaChTrackLevel);

    if (isUACHOptionAvailable) {
      this.uaChTrackLevel = options.uaChTrackLevel;
    }

    if (navigator.userAgentData) {
      getUserAgentClientHint((uach) => {
        this.uach = uach;
      }, this.uaChTrackLevel);
    }

    if (options && options.integrations) {
      Object.assign(this.loadOnlyIntegrations, options.integrations);
      transformToRudderNames(this.loadOnlyIntegrations);
    }

    this.useGlobalIntegrationsConfigInEvents =
      options && options.useGlobalIntegrationsConfigInEvents === true;

    if (options && options.sendAdblockPage) {
      this.sendAdblockPage = true;
    }
    if (
      options &&
      options.sendAdblockPageOptions &&
      typeof options.sendAdblockPageOptions === 'object'
    ) {
      this.sendAdblockPageOptions = options.sendAdblockPageOptions;
    }
    // Session initialization
    this.uSession.initialize(options);

    if (options && options.clientSuppliedCallbacks) {
      // convert to ht events recognized method names
      const transformedCallbackMapping = {};
      Object.keys(this.methodToCallbackMapping).forEach((methodName) => {
        if (
          this.methodToCallbackMapping.hasOwnProperty(methodName) &&
          options.clientSuppliedCallbacks[this.methodToCallbackMapping[methodName]]
        ) {
          transformedCallbackMapping[methodName] =
            options.clientSuppliedCallbacks[this.methodToCallbackMapping[methodName]];
        }
      });
      Object.assign(this.clientSuppliedCallbacks, transformedCallbackMapping);
      this.registerCallbacks(true);
    }

    if (options && options.loadIntegration != undefined) {
      this.loadIntegration = !!options.loadIntegration;
    }

    if (options && typeof options.bufferDataPlaneEventsUntilReady === 'boolean') {
      this.bufferDataPlaneEventsUntilReady = options.bufferDataPlaneEventsUntilReady === true;
      if (this.bufferDataPlaneEventsUntilReady) {
        this.preProcessQueue.init(this.options, this.queueEventForDataPlane.bind(this));
      }
    }

    if (options && typeof options.dataPlaneEventsBufferTimeout === 'number') {
      this.dataPlaneEventsBufferTimeout = options.dataPlaneEventsBufferTimeout;
    }

    if (options && options.lockIntegrationsVersion !== undefined) {
      this.lockIntegrationsVersion = options.lockIntegrationsVersion === true;
    }

    this.initializeUser(
      options ? options.anonymousIdOptions : undefined,
      options ? options.userIdOptions : undefined,
    );
    this.setInitialPageProperties();

    this.destSDKBaseURL = getIntegrationsCDNPath(
      this.version,
      this.lockIntegrationsVersion,
      options && options.destSDKBaseURL,
    );

    if (options && options.getSourceConfig) {
      if (typeof options.getSourceConfig !== 'function') {
        handleError(new Error('option "getSourceConfig" must be a function'));
      } else {
        const res = options.getSourceConfig();

        if (res instanceof Promise) {
          res.then((pRes) => this.processResponse(200, pRes)).catch(handleError);
        } else {
          this.processResponse(200, res);
        }
      }
      return;
    }

    let configUrl = getConfigUrl(writeKey);
    if (options && options.configUrl) {
      configUrl = getUserProvidedConfigUrl(options.configUrl, configUrl);
    }

    try {
      getJSONTrimmed(this, configUrl, writeKey, this.processResponse);
    } catch (error) {
      handleError(error);
    }
  }

  arePolyfillsRequired(options) {
    // check if the below features are available in the browser or not
    // If not present dynamically load from the polyfill cdn, unless
    // the options are configured not to.
    const polyfillIfRequired =
      options && typeof options.polyfillIfRequired === 'boolean'
        ? options.polyfillIfRequired
        : true;
    return (
      polyfillIfRequired &&
      (!String.prototype.endsWith ||
        !String.prototype.startsWith ||
        !String.prototype.includes ||
        !Array.prototype.find ||
        !Array.prototype.includes ||
        typeof window.URL !== 'function' ||
        typeof Promise === 'undefined' ||
        !Object.entries ||
        !Object.values ||
        !String.prototype.replaceAll ||
        !this.isDatasetAvailable() ||
        typeof TextDecoder !== 'function' ||
        typeof Uint8Array !== 'function')
    );
  }

  /**
   * Call control pane to get client configs
   *
   * @param {*} writeKey
   * @memberof Analytics
   */
  load(writeKey, serverUrl, options) {
    // logger.debug("inside load ");
    if (this.loaded) return;

    // clone options
    const clonedOptions = R.clone(options);
    if (this.arePolyfillsRequired(clonedOptions)) {
      const id = 'polyfill';
      ScriptLoader(id, POLYFILL_URL, { skipDatasetAttributes: true });
      const self = this;
      const interval = setInterval(() => {
        // check if the polyfill is loaded
        // In chrome 83 and below versions ID of a script is not part of window's scope
        // even though it is loaded and returns false for <window.hasOwnProperty("polyfill")> this.
        // So, added another checking to fulfill that purpose.
        if (
          (window.hasOwnProperty(id) || document.getElementById(id) !== null) &&
          typeof Promise !== 'undefined'
        ) {
          clearInterval(interval);
          self.loadAfterPolyfill(writeKey, serverUrl, clonedOptions);
        }
      }, 100);

      setTimeout(() => {
        clearInterval(interval);
      }, MAX_WAIT_FOR_INTEGRATION_LOAD);
    } else {
      this.loadAfterPolyfill(writeKey, serverUrl, clonedOptions);
    }
  }

  ready(callback) {
    if (!this.loaded) {
      this.toBeProcessedArray.push(['ready', callback]);
      return;
    }
    if (typeof callback === 'function') {
      /**
       * If integrations are loaded or no integration is available for loading
       * execute the callback immediately
       * else push the callbacks to a queue that will be executed after loading completes
       */
      if (this.clientIntegrationsReady) {
        callback();
      } else {
        this.readyCallbacks.push(callback);
      }
      return;
    }
    logger.error('ready callback is not a function');
  }

  initializeCallbacks() {
    Object.keys(this.methodToCallbackMapping).forEach((methodName) => {
      if (this.methodToCallbackMapping.hasOwnProperty(methodName)) {
        this.on(methodName, () => {});
      }
    });
  }

  registerCallbacks(calledFromLoad) {
    if (!calledFromLoad) {
      Object.keys(this.methodToCallbackMapping).forEach((methodName) => {
        if (
          this.methodToCallbackMapping.hasOwnProperty(methodName) &&
          window.hightouchevents &&
          typeof window.hightouchevents[this.methodToCallbackMapping[methodName]] === 'function'
        ) {
          this.clientSuppliedCallbacks[methodName] =
            window.hightouchevents[this.methodToCallbackMapping[methodName]];
        }
        // let callback =
        //   ? typeof window.hightouchevents[
        //       this.methodToCallbackMapping[methodName]
        //     ] == "function"
        //     ? window.hightouchevents[this.methodToCallbackMapping[methodName]]
        //     : () => {}
        //   : () => {};

        // logger.debug("registerCallbacks", methodName, callback);

        // this.on(methodName, callback);
      });
    }

    Object.keys(this.clientSuppliedCallbacks).forEach((methodName) => {
      if (this.clientSuppliedCallbacks.hasOwnProperty(methodName)) {
        // logger.debug(
        //   "registerCallbacks",
        //   methodName,
        //   this.clientSuppliedCallbacks[methodName]
        // );
        this.on(methodName, this.clientSuppliedCallbacks[methodName]);
      }
    });
  }

  sendSampleRequest() {
    ScriptLoader('ad-block', '//pagead2.googlesyndication.com/pagead/js/adsbygoogle.js', {
      isNonNativeSDK: true,
    });
  }

  /**
   * A public method to start a session
   * @param {string} sessionId     session identifier
   * @returns
   */
  startSession(sessionId) {
    this.uSession.start(sessionId);
  }

  /**
   * A public method to end an ongoing session.
   */
  endSession() {
    this.uSession.end();
  }

  setAuthToken(token) {
    if (typeof token !== 'string') {
      logger.error('Provided input should be in string format');
      return;
    }
    this.storage.setAuthToken(token);
    this.transformationHandler.setAuthToken(token);
  }
}

const instance = new Analytics();

function processDataInAnalyticsArray(analytics) {
  if (analytics.toBeProcessedArray.length > 0) {
    while (analytics.toBeProcessedArray.length > 0) {
      const event = [...analytics.toBeProcessedArray[0]];

      // remove the element from the queue
      analytics.toBeProcessedArray.shift();

      const method = event[0];
      event.shift();
      // logger.debug("=====from analytics array, calling method:: ", method)
      analytics[method](...event);
    }
  }
}

/**
 * parse the given url into usable Rudder object
 * @param {*} url
 */
function retrieveEventsFromQueryString(url) {
  const queryDefaults = {
    trait: 'ajs_trait_',
    prop: 'ajs_prop_',
  };

  function getDataFromQueryObj(qObj, dataType) {
    const data = {};
    Object.keys(qObj).forEach((key) => {
      if (key.startsWith(dataType)) {
        data[key.substr(dataType.length)] = qObj[key];
      }
    });
    return data;
  }

  const queryObject = parseQueryString(url);
  if (queryObject.ajs_aid) {
    instance.toBeProcessedArray.push(['setAnonymousId', queryObject.ajs_aid]);
  }

  if (queryObject.ajs_uid) {
    instance.toBeProcessedArray.push([
      'identify',
      queryObject.ajs_uid,
      getDataFromQueryObj(queryObject, queryDefaults.trait),
    ]);
  }

  if (queryObject.ajs_event) {
    instance.toBeProcessedArray.push([
      'track',
      queryObject.ajs_event,
      getDataFromQueryObj(queryObject, queryDefaults.prop),
    ]);
  }
}

Emitter(instance);

window.addEventListener(
  'error',
  (e) => {
    handleError(e, undefined, instance);
  },
  true,
);

// initialize supported callbacks
instance.initializeCallbacks();

// register supported callbacks
instance.registerCallbacks(false);

const defaultMethod = 'load';
const argumentsArray = window.hightouchevents;
const isValidArgsArray = Array.isArray(argumentsArray);
let defaultEvent;
if (isValidArgsArray) {
  /**
   * Iterate the buffered API calls until we find load call and
   * queue it first for processing
   */
  let i = 0;
  while (i < argumentsArray.length) {
    if (argumentsArray[i] && argumentsArray[i][0] === defaultMethod) {
      defaultEvent = argumentsArray[i];
      argumentsArray.splice(i, 1);
      break;
    }
    i += 1;
  }
}

// parse querystring of the page url to send events
retrieveEventsFromQueryString(window.location.href);

if (isValidArgsArray) argumentsArray.forEach((x) => instance.toBeProcessedArray.push(x));

// Process load method if present in the buffered requests
if (defaultEvent && defaultEvent.length > 0) {
  defaultEvent.shift();
  instance[defaultMethod](...defaultEvent);
}

const ready = instance.ready.bind(instance);
const identify = instance.identify.bind(instance);
const page = instance.page.bind(instance);
const track = instance.track.bind(instance);
const alias = instance.alias.bind(instance);
const group = instance.group.bind(instance);
const reset = instance.reset.bind(instance);
const load = instance.load.bind(instance);
const initialized = (instance.initialized = true);
const getUserId = instance.getUserId.bind(instance);
const getSessionId = instance.getSessionId.bind(instance);
const getUserTraits = instance.getUserTraits.bind(instance);
const getAnonymousId = instance.getAnonymousId.bind(instance);
const setAnonymousId = instance.setAnonymousId.bind(instance);
const getGroupId = instance.getGroupId.bind(instance);
const getGroupTraits = instance.getGroupTraits.bind(instance);
const startSession = instance.startSession.bind(instance);
const endSession = instance.endSession.bind(instance);
const setAuthToken = instance.setAuthToken.bind(instance);

export {
  initialized,
  ready,
  page,
  track,
  load,
  identify,
  reset,
  alias,
  group,
  getUserId,
  getSessionId,
  getUserTraits,
  getAnonymousId,
  setAnonymousId,
  getGroupId,
  getGroupTraits,
  startSession,
  endSession,
  setAuthToken,
};
