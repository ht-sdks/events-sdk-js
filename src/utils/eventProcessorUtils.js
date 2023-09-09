import logger from './logUtil';
import { mergeDeepRight } from './ObjectUtils';
import { SYSTEM_KEYWORDS } from './constants';

const defaultTopLevelElements = ['integrations', 'anonymousId', 'originalTimestamp'];

const mergeTopLevelElementsMutator = (htElementMessage, options = {}) => {
  if (typeof options !== 'object' || options === null) {
    return;
  }

  Object.keys(options).forEach((key) => {
    if (defaultTopLevelElements.includes(key)) {
      // eslint-disable-next-line no-param-reassign
      htElementMessage[key] = options[key];
    }
  });
};

const mergeContext = (htElementMessage, options = {}) => {
  let { context } = htElementMessage;

  if (typeof options !== 'object' || options === null) {
    return context;
  }

  Object.keys(options).forEach((key) => {
    if (!defaultTopLevelElements.includes(key) && !SYSTEM_KEYWORDS.includes(key)) {
      if (key !== 'context') {
        context = mergeDeepRight(context, {
          [key]: options[key],
        });
      } else if (typeof options[key] === 'object' && options[key] !== null) {
        const tempContext = {};
        Object.keys(options[key]).forEach((e) => {
          if (!SYSTEM_KEYWORDS.includes(e)) {
            tempContext[e] = options[key][e];
          }
        });
        context = mergeDeepRight(context, {
          ...tempContext,
        });
      } else {
        logger.error(
          `[Analytics: processOptionsParam] context passed in options ${key} is not object.`,
        );
      }
    }
  });
  return context;
};

export { mergeContext, mergeTopLevelElementsMutator };
