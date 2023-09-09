# Events SDK Javascript

## Installation

```bash
npm install @ht-sdks/events-sdk-js --save
```

**Note that this NPM module is only meant to be used for a browser installation**. If you want to integrate with your Node.js application, refer to the [**Node.js repository**](https://github.com/ht-sdks/events-sdk-node).
<br><br>

**IMPORTANT**: You should run the following code snippet only once and use the exported object throughout your project (e.g. Node module caching):

```javascript
import * as analytics from "@ht-sdks/events-sdk-js";
analytics.ready(() => {
  console.log("we are all set!!!");
});
analytics.load(<WRITE_KEY>, <DATA_PLANE_URL>, {configUrl: <CONTROL_PLANE_URL> });
export { analytics };
```

You can also do this with **ES5** using the `require` method, as shown:

```javascript
var analytics = require("@ht-sdks/events-sdk-js");
analytics.load(<WRITE_KEY>, <DATA_PLANE_URL>, {config:Url: <CONTROL_PLANE_URL>});
exports.analytics = analytics;
```

### Exported APIs

The APIs exported by the module are:

- `load`
- `ready`
- `identify`
- `alias`
- `page`
- `track`
- `group`
- `reset`
- `getAnonymousId`
- `setAnonymousId`

### Supported browser versions

| **Browser**     | **Supported Versions** |
| :-------------- | :--------------------- |
| Safari          | v7 or later            |
| IE              | v10 or later           |
| Edge            | v15 or later           |
| Mozilla Firefox | v40 or later           |
| Chrome          | v37 or later           |
| Opera           | v23 or later           |
| Yandex          | v14.12 or later        |

> If the SDK does not work on the browser versions that you are targeting, verify if adding the browser polyfills to your application solves the issue.

## Identifying users

The `identify` call lets you identify a visiting user and associate them to their actions. It also lets you record the traits about them like their name, email address, etc.

A sample `identify()` call is shown below:

```javascript
analytics.identify(
  '12345',
  {
    email: 'name@domain.com',
  },
  {
    page: {
      path: '',
      referrer: '',
      search: '',
      title: '',
      url: '',
    },
  },
  () => {
    console.log('in identify call');
  },
);
```

In the above example, the user-related information like the `userId` and `email` (and other contextual info) is captured.

> There is no need to call `identify()` for anonymous visitors to your website. Such visitors are automatically assigned an `anonymousId`.

## Tracking user actions

The `track` call lets you record the customer events, i.e. the actions that they perform, along with any associated properties.

A sample `track` call is shown below:

```javascript
analytics.track(
  'test track event GA3',
  {
    revenue: 30,
    currency: 'USD',
    user_actual_id: 12345,
  },
  () => {
    console.log('in track call');
  },
);
```

In the above example, the `track` method tracks the user event ‘**test track event GA3**’ and information such as the `revenue`, `currency`, `anonymousId`.

> You can use the `track` method to track various success metrics for your website like user signups, item purchases, article bookmarks, and more.

## The `ready` API

There are cases when you may want to tap into the features provided by the end-destination SDKs to enhance tracking and other functionalities. The JavaScript SDK exposes a `ready` API with a `callback` parameter that fires when the SDK is done initializing itself and the other third-party native SDK destinations.

An example is shown in the following snippet:

```javascript
analytics.ready(() => {
  console.log('we are all set!!!');
});
```
