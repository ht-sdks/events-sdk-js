/* eslint-disable class-methods-use-this */
import get from "get-value";
import logger from "../../utils/logUtil";
import ScriptLoader from "../ScriptLoader";
import {
  extractCustomFields,
  getDefinedTraits,
  isArray,
  isObject,
} from "../../utils/utils";

class Clevertap {
  constructor(config) {
    this.accountId = config.accountId;
    this.apiKey = config.passcode;
    this.name = "CLEVERTAP";
    this.region = config.region;
    this.keysToExtract = ["context.traits"];
    this.exclusionKeys = [
      "email",
      "E-mail",
      "Email",
      "phone",
      "Phone",
      "name",
      "Name",
      "gender",
      "Gender",
      "birthday",
      "Birthday",
      "anonymousId",
      "userId",
    ];
  }

  init() {
    logger.debug("===in init Clevertap===");
    const sourceUrl =
      document.location.protocol == "https:"
        ? "https://d2r1yp2w7bby2u.cloudfront.net/js/a.js"
        : "http://static.clevertap.com/js/a.js";

    window.clevertap = {
      event: [],
      profile: [],
      account: [],
      onUserLogin: [],
      notifications: [],
    };
    window.clevertap.enablePersonalization = true;
    window.clevertap.account.push({ id: this.accountId });
    if (this.region && this.region !== "none") {
      window.clevertap.region.push(this.region);
    }

    ScriptLoader("clevertap-integration", sourceUrl);
  }

  isLoaded() {
    logger.debug("in clevertap isLoaded");
    return !!window.clevertap && window.clevertap.logout !== undefined;
  }

  isReady() {
    logger.debug("in clevertap isReady");
    return !!window.clevertap && window.clevertap.logout !== undefined;
  }

  identify(rudderElement) {
    logger.debug("in clevertap identify");

    const { message } = rudderElement;
    if (!(message.context && message.context.traits)) {
      logger.error("user traits not present");
      return;
    }
    const { userId, email, phone, name } = getDefinedTraits(message);
    let payload = {
      Name: name,
      Identity: userId,
      Email: email,
      Phone: phone,
      Gender: get(message, "context.traits.gender"),
      DOB: get(message, "context.traits.birthday"),
    };
    // Extract other K-V property from traits about user custom properties
    try {
      payload = extractCustomFields(
        message,
        payload,
        this.keysToExtract,
        this.exclusionKeys
      );
    } catch (err) {
      logger.debug(`Error occured at extractCustomFields ${err}`);
    }
    Object.values(payload).map((vals) => {
      if (isObject(vals)) {
        logger.debug("cannot process, unsupported traits");
        return;
      }
    });
    window.clevertap.onUserLogin.push({
      Site: payload,
    });
  }

  track(rudderElement) {
    logger.debug("in clevertap track");
    const { event, properties } = rudderElement.message;
    if (properties) {
      if (event === "Order Completed") {
        let ecomProperties = {
          "Charged ID": properties.checkout_id,
          Amount: properties.revenue,
          Items: properties.products,
        };
        // Extract other K-V property from traits about user custom properties
        try {
          ecomProperties = extractCustomFields(
            rudderElement.message,
            ecomProperties,
            ["properties"],
            ["checkout_id", "revenue", "products"]
          );
        } catch (err) {
          logger.debug(`Error occured at extractCustomFields ${err}`);
        }
        window.clevertap.event.push("Charged", ecomProperties);
      } else {
        Object.values(properties).map((vals) => {
          if (isObject(vals) || isArray(vals)) {
            logger.debug("cannot process, unsupported event");
            return;
          }
        });
        window.clevertap.event.push(event, properties);
      }
    } else if (event === "Order Completed") {
      window.clevertap.event.push("Charged");
    } else {
      window.clevertap.event.push(event);
    }
  }

  page(rudderElement) {
    logger.debug("in clevertap page");
    const { name, properties } = rudderElement.message;
    let eventName;
    if (properties && properties.category && name) {
      eventName = `Viewed ${properties.category} ${name} page`;
    } else if (name) {
      eventName = `Viewed ${name} page`;
    } else {
      eventName = "Viewed a Page";
    }
    if (properties) {
      Object.values(properties).map((vals) => {
        if (isObject(vals) || isArray(vals)) {
          logger.debug("cannot process, unsupported event");
          return;
        }
      });
      window.clevertap.event.push(eventName, properties);
    } else {
      window.clevertap.event.push(eventName);
    }
  }
}

export default Clevertap;
