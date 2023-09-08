function wait(time) {
  return new Promise((resolve) => {
    setTimeout(resolve, time);
  });
}

describe('Test suite for the SDK', () => {
  const xhrMock = {
    open: jest.fn(),
    setRequestHeader: jest.fn(),
    onload: jest.fn(),
    onreadystatechange: jest.fn(),
    readyState: 4,
    responseText: JSON.stringify({
      source: {
        config: {},
        id: 'id',
        destinations: [],
      },
    }),
    status: 200,
  };

  xhrMock['send'] = jest.fn(() => xhrMock.onload());

  const userId = 'jest-user-id';
  const userTraits = {
    'jest-user-trait-key-1': 'jest-user-trait-value-1',
    'jest-user-trait-key-2': 'jest-user-trait-value-2',
  };

  const groupUserId = 'jest-group-id';
  const groupTraits = {
    'jest-group-trait-key-1': 'jest-group-trait-value-1',
    'jest-group-trait-key-2': 'jest-group-trait-value-2',
  };

  beforeEach(async () => {
    jest.resetModules();

    window.XMLHttpRequest = jest.fn(() => xhrMock);

    document.head.innerHTML = ` `;
    hightouchevents = window.hightouchevents = [];
    for (
      var methods = [
          'load',
          'page',
          'track',
          'alias',
          'group',
          'identify',
          'ready',
          'reset',
          'getUserTraits',
          'getAnonymousId',
          'getUserId',
          'getUserTraits',
          'getGroupId',
          'getGroupTraits',
          'setAnonymousId',
        ],
        i = 0;
      i < methods.length;
      i++
    ) {
      var method = methods[i];
      hightouchevents[method] = (function (d) {
        return function () {
          hightouchevents.push([d, ...arguments]);
        };
      })(method);
    }
    hightouchevents.load('WRITE_KEY', 'DATA_PLANE_URL');
    require('./prodsdk.js');
    await wait(500);
  });

  it("If SDK script is 'required' (imported), then check that it is loaded and queued API calls are processed", () => {
    // Only done for this case to test the
    // API calls queuing functionality
    jest.resetModules();
    hightouchevents.page();
    require('./prodsdk.js');

    expect(global.hightouchevents.push).not.toBe(Array.prototype.push);

    // one source config endpoint call and one implicit page call
    // Refer to above 'beforeEach'
    expect(xhrMock.send).toHaveBeenCalledTimes(2);
  });

  it('If APIs are called, then appropriate network requests are made', () => {
    hightouchevents.page();
    hightouchevents.track('test-event');
    hightouchevents.identify('jest-user');
    hightouchevents.group('jest-group');
    hightouchevents.alias('new-jest-user', 'jest-user');

    // one source config endpoint call and above API requests
    expect(xhrMock.send).toHaveBeenCalledTimes(6);
  });

  describe("Test group for 'getAnonymousId' API", () => {
    it("If 'getAnonymousId' API is invoked with no prior persisted data, then a UUID value is returned", () => {
      const anonId = hightouchevents.getAnonymousId();

      const uuidRegEx = /^[a-z0-9]{8}-[a-z0-9]{4}-4[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{12}$/;
      expect(anonId).toMatch(uuidRegEx);
    });

    it("If SDK generates anonymous ID, then it'll be persisted", () => {
      const anonIdRes1 = hightouchevents.getAnonymousId();

      // SDK remembers the previously generated anonymous ID and returns the same value
      const anonIdRes2 = hightouchevents.getAnonymousId();

      expect(anonIdRes1).toEqual(anonIdRes2);
    });
  });

  describe("Test group for 'reset' API", () => {
    it("If 'reset' API is invoked without setting the flag, then all persisted data except for anonymous ID is cleared", () => {
      // Make identify and group API calls to let the SDK persist
      // user (ID and traits) and group data (ID and traits)
      hightouchevents.identify(userId, userTraits);
      hightouchevents.group(groupUserId, groupTraits);

      const anonId = 'jest-anon-ID';
      hightouchevents.setAnonymousId(anonId);

      // SDK clears all the persisted data except for anonymous ID
      hightouchevents.reset();

      // SDK remembers the previously generated anonymous ID and returns the same value
      const anonIdRes = hightouchevents.getAnonymousId();

      expect(anonId).toEqual(anonIdRes);
      expect(hightouchevents.getUserId()).toEqual('');
      expect(hightouchevents.getUserTraits()).toEqual({});
      expect(hightouchevents.getGroupId()).toEqual('');
      expect(hightouchevents.getGroupTraits()).toEqual({});
    });

    it("If 'reset' API is invoked with the flag set to 'true', then all the persisted data is cleared", () => {
      // Make identify and group API calls to let the SDK persist
      // user (ID and traits) and group data (ID and traits)
      hightouchevents.identify(userId, userTraits);
      hightouchevents.group(groupUserId, groupTraits);

      const anonId = 'jest-anon-ID';
      hightouchevents.setAnonymousId(anonId);

      // SDK clears all the persisted data
      hightouchevents.reset(true);

      // SDK remembers the previously generated anonymous ID and returns the same value
      const anonIdRes = hightouchevents.getAnonymousId();

      expect(anonId).not.toEqual(anonIdRes);
      expect(hightouchevents.getUserId()).toEqual('');
      expect(hightouchevents.getUserTraits()).toEqual({});
      expect(hightouchevents.getGroupId()).toEqual('');
      expect(hightouchevents.getGroupTraits()).toEqual({});
    });
  });
});
