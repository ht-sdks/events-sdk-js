import { mergeContext, mergeTopLevelElementsMutator } from '../../src/utils/eventProcessorUtils';

const libName = 'Events SDK JavaScript';

describe('Event processor Utilities', () => {
  const htElement = {
    message: {
      channel: 'web',
      context: {
        app: {
          name: libName,
          namespace: 'com.hightouch.javascript',
          version: '2.22.0',
        },
        traits: {
          firstName: 'Tintin',
          phone: '1234567890',
          email: 'tintin@twentiethcentury.com',
          custom_flavor: 'chocolate',
          custom_date: 1673597638545,
          address: [
            { label: 'office', city: 'Brussels', country: 'Belgium' },
            { label: 'home', city: 'Kolkata', country: 'India' },
          ],
        },
        library: { name: libName, version: '2.22.0' },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        device: null,
        network: null,
        os: { name: '', version: '' },
        locale: 'en-GB',
        screen: { density: 2, width: 1440, height: 900, innerWidth: 1440, innerHeight: 253 },
        sessionId: 1673597629454,
        sessionStart: true,
      },
      type: 'identify',
      messageId: '55fc2294-4622-4deb-be84-9c42372b64cd',
      originalTimestamp: '2023-01-13T08:13:58.548Z',
      anonymousId: '50cdaf05-ce75-418c-b666-98b9a9938f9f',
      userId: 'user-id',
      event: null,
      properties: null,
      integrations: { All: true },
      user_properties: null,
    },
  };
  const options = { a: 'moumita', key1: 123456, key2: { fg: 'shgjsh' } };
  const optionsWithTopLevelContext = {
    integrations: {
      All: true,
      'Google Analytics': false,
    },
    anonymousId: 'sample anonymousId',
    originalTimestamp: '2023-01-13T09:13:58.548Z',
  };
  const optionsWithLibraryInfo = {
    ...options,
    library: {
      name: 'Random SDK',
    },
    context: {
      library: {
        name: 'Random SDK no 2',
      },
      metaData: {
        key3: 976545678,
        key4: null,
      },
    },
  };
  const optionsWithNullContext = {
    ...options,
    context: null,
  };

  const expectedHtElement = {
    message: {
      channel: 'web',
      context: {
        a: 'moumita',
        key1: 123456,
        key2: { fg: 'shgjsh' },
        app: {
          name: libName,
          namespace: 'com.hightouch.javascript',
          version: '2.22.0',
        },
        traits: {
          firstName: 'Tintin',
          phone: '1234567890',
          email: 'tintin@twentiethcentury.com',
          custom_flavor: 'chocolate',
          custom_date: 1673597638545,
          address: [
            { label: 'office', city: 'Brussels', country: 'Belgium' },
            { label: 'home', city: 'Kolkata', country: 'India' },
          ],
        },
        library: { name: libName, version: '2.22.0' },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        device: null,
        network: null,
        os: { name: '', version: '' },
        locale: 'en-GB',
        screen: { density: 2, width: 1440, height: 900, innerWidth: 1440, innerHeight: 253 },
        sessionId: 1673597629454,
        sessionStart: true,
      },
      type: 'identify',
      messageId: '55fc2294-4622-4deb-be84-9c42372b64cd',
      originalTimestamp: '2023-01-13T08:13:58.548Z',
      anonymousId: '50cdaf05-ce75-418c-b666-98b9a9938f9f',
      userId: 'user-id',
      event: null,
      properties: null,
      integrations: { All: true },
      user_properties: null,
    },
  };
  const expectedHtElementWithTopLevelElement = {
    message: {
      channel: 'web',
      context: {
        app: {
          name: libName,
          namespace: 'com.hightouch.javascript',
          version: '2.22.0',
        },
        traits: {
          firstName: 'Tintin',
          phone: '1234567890',
          email: 'tintin@twentiethcentury.com',
          custom_flavor: 'chocolate',
          custom_date: 1673597638545,
          address: [
            { label: 'office', city: 'Brussels', country: 'Belgium' },
            { label: 'home', city: 'Kolkata', country: 'India' },
          ],
        },
        library: { name: libName, version: '2.22.0' },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        device: null,
        network: null,
        os: { name: '', version: '' },
        locale: 'en-GB',
        screen: { density: 2, width: 1440, height: 900, innerWidth: 1440, innerHeight: 253 },
        sessionId: 1673597629454,
        sessionStart: true,
      },
      type: 'identify',
      messageId: '55fc2294-4622-4deb-be84-9c42372b64cd',
      originalTimestamp: '2023-01-13T09:13:58.548Z',
      anonymousId: 'sample anonymousId',
      userId: 'user-id',
      event: null,
      properties: null,
      integrations: { All: true, 'Google Analytics': false },
      user_properties: null,
    },
  };

  const expectedHtElementWithLibraryInfo = {
    message: {
      channel: 'web',
      context: {
        a: 'moumita',
        key1: 123456,
        key2: { fg: 'shgjsh' },
        app: {
          name: libName,
          namespace: 'com.hightouch.javascript',
          version: '2.22.0',
        },
        traits: {
          firstName: 'Tintin',
          phone: '1234567890',
          email: 'tintin@twentiethcentury.com',
          custom_flavor: 'chocolate',
          custom_date: 1673597638545,
          address: [
            { label: 'office', city: 'Brussels', country: 'Belgium' },
            { label: 'home', city: 'Kolkata', country: 'India' },
          ],
        },
        library: { name: libName, version: '2.22.0' },
        metaData: {
          key3: 976545678,
          key4: null,
        },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
        device: null,
        network: null,
        os: { name: '', version: '' },
        locale: 'en-GB',
        screen: { density: 2, width: 1440, height: 900, innerWidth: 1440, innerHeight: 253 },
        sessionId: 1673597629454,
        sessionStart: true,
      },
      type: 'identify',
      messageId: '55fc2294-4622-4deb-be84-9c42372b64cd',
      originalTimestamp: '2023-01-13T08:13:58.548Z',
      anonymousId: '50cdaf05-ce75-418c-b666-98b9a9938f9f',
      userId: 'user-id',
      event: null,
      properties: null,
      integrations: { All: true },
      user_properties: null,
    },
  };

  it('Should merge the context provided in options with the previous context', () => {
    const mergedRudderMessageContext = mergeContext(htElement.message, options);
    expect(mergedRudderMessageContext).toStrictEqual(expectedHtElement.message.context);
  });

  it('Should context object remain intact if no options provided', () => {
    const mergedRudderMessageContext = mergeContext(htElement.message, undefined);
    expect(mergedRudderMessageContext).toStrictEqual(htElement.message.context);
  });

  it('Should context object remain intact if null options provided', () => {
    const mergedRudderMessageContext = mergeContext(htElement.message, null);
    expect(mergedRudderMessageContext).toStrictEqual(htElement.message.context);
  });

  it('Should context object remain intact if non object type options provided', () => {
    const mergedRudderMessageContext = mergeContext(htElement.message, 'options');
    expect(mergedRudderMessageContext).toStrictEqual(htElement.message.context);
  });

  it('Should mutate the top level context in ht element if provided in options', () => {
    mergeTopLevelElementsMutator(htElement.message, optionsWithTopLevelContext);
    expect(htElement.message).toStrictEqual(expectedHtElementWithTopLevelElement.message);
  });

  it('Should top level context object remain intact if no options provided', () => {
    mergeTopLevelElementsMutator(htElement.message, undefined);
    expect(htElement.message).toStrictEqual(htElement.message);
  });

  it('Should top level context object remain intact if null options provided', () => {
    mergeTopLevelElementsMutator(htElement.message, null);
    expect(htElement.message).toStrictEqual(htElement.message);
  });

  it('Should top level context object remain intact if non object type options provided', () => {
    mergeTopLevelElementsMutator(htElement.message, 'options');
    expect(htElement.message).toStrictEqual(htElement.message);
  });

  it('Should not override library info in context if provided in options', () => {
    const mergedRudderMessageContext = mergeContext(htElement.message, optionsWithLibraryInfo);
    expect(mergedRudderMessageContext).toStrictEqual(
      expectedHtElementWithLibraryInfo.message.context,
    );
  });

  it('Should not merge null context if provided in options', () => {
    const mergedRudderMessageContext = mergeContext(htElement.message, optionsWithNullContext);
    expect(mergedRudderMessageContext).toStrictEqual(expectedHtElement.message.context);
  });
});
