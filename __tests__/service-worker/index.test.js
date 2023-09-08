import { advanceTo } from 'jest-date-mock';
import { Analytics } from '../../src/service-worker';
import { server } from './__mocks__/msw.server';
import {
  aliasRequestPayload,
  dummyDataplaneHost,
  dummyInitOptions,
  dummyWriteKey,
  groupRequestPayload,
  identifyRequestPayload,
  pageRequestPayload,
  screenRequestPayload,
  trackRequestPayload,
} from './__mocks__/fixtures';

jest.mock('uuid', () => ({ v4: () => '123456789' }));

describe('JS SDK Service Worker', () => {
  let hightouchEventsClient = null;
  let requestBody;

  beforeAll(() => {
    advanceTo(new Date(2022, 1, 21, 0, 0, 0));
    server.listen();
  });

  beforeEach(() => {
    hightouchEventsClient = new Analytics(dummyWriteKey, dummyDataplaneHost, dummyInitOptions);
    server.events.on('request:start', (req) => {
      requestBody = req.body;
    });
  });

  afterEach(() => {
    hightouchEventsClient = null;
    server.resetHandlers();
    server.events.removeAllListeners();
    requestBody = null;
  });

  afterAll(() => {
    server.close();
  });

  it('Should initialise with correct values', () => {
    expect(hightouchEventsClient.writeKey).toBe(dummyWriteKey);
    expect(hightouchEventsClient.host).toBe(dummyDataplaneHost);
    expect(hightouchEventsClient.timeout).toBe(dummyInitOptions.timeout);
    expect(hightouchEventsClient.flushAt).toBe(dummyInitOptions.flushAt);
    expect(hightouchEventsClient.flushInterval).toBe(dummyInitOptions.flushInterval);
    expect(hightouchEventsClient.maxInternalQueueSize).toBe(dummyInitOptions.maxInternalQueueSize);
    expect(hightouchEventsClient.logLevel).toBe(dummyInitOptions.logLevel);
    expect(hightouchEventsClient.enable).toBe(dummyInitOptions.enable);
  });

  it('Should record identify', async () => {
    hightouchEventsClient.identify(identifyRequestPayload);
    hightouchEventsClient.flush();

    await new Promise((r) => setTimeout(r, 1));

    expect(requestBody.batch[0]).toEqual(expect.objectContaining(identifyRequestPayload));
  });

  it('Should record track', async () => {
    hightouchEventsClient.track(trackRequestPayload);
    hightouchEventsClient.flush();

    await new Promise((r) => setTimeout(r, 1));

    expect(requestBody.batch[0]).toEqual(expect.objectContaining(trackRequestPayload));
  });

  it('Should record page', async () => {
    hightouchEventsClient.page(pageRequestPayload);
    hightouchEventsClient.flush();

    await new Promise((r) => setTimeout(r, 1));

    expect(requestBody.batch[0]).toEqual(expect.objectContaining(pageRequestPayload));
  });

  it('Should record screen', async () => {
    hightouchEventsClient.screen(screenRequestPayload);
    hightouchEventsClient.flush();

    await new Promise((r) => setTimeout(r, 1));

    expect(requestBody.batch[0]).toEqual(expect.objectContaining(screenRequestPayload));
  });

  it('Should record group', async () => {
    hightouchEventsClient.group(groupRequestPayload);
    hightouchEventsClient.flush();

    await new Promise((r) => setTimeout(r, 1));

    expect(requestBody.batch[0]).toEqual(expect.objectContaining(groupRequestPayload));
  });

  it('Should record alias', async () => {
    hightouchEventsClient.alias(aliasRequestPayload);
    hightouchEventsClient.flush();

    await new Promise((r) => setTimeout(r, 1));

    expect(requestBody.batch[0]).toEqual(expect.objectContaining(aliasRequestPayload));
  });
});
