# Events Javascript SDK

## Installation

To integrate the JavaScript SDK with your website, place the following code snippet in the `<head>` section of your website.

```javascript
<script type="text/javascript">
!function(){var e=window.hightouchevents=window.hightouchevents||[];e.methods=["load","page","track","identify","alias","group","ready","reset","getAnonymousId","setAnonymousId"],e.factory=function(t){return function(){e.push([t].concat(Array.prototype.slice.call(arguments)))}};for(var t=0;t<e.methods.length;t++){var r=e.methods[t];e[r]=e.factory(r)}e.loadJS=function(e,t){var r=document.createElement("script");r.type="text/javascript",r.async=!0,r.src="https://d1xt4zx4uzh8tq.cloudfront.net/latest/events.min.js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(r,a)},e.loadJS(),
e.load(<WRITE_KEY>,<DATA_PLANE_URL>,{configUrl: <CONTROL_PLANE_URL>}),
e.page()}();
</script>
```

The above snippet lets you integrate the SDK with your website and load it asynchronously to keep your page load time unaffected.

To load `hightouch-events.js` on to your page synchronously, you can refer to the minified or non-minified versions of the code in the following sections:

### Minified code

```html
<script>
  hightouchevents=window.hightouchevents=[];for(var methods=["load","page","track","identify","alias","group","ready","reset","getAnonymousId","setAnonymousId"],i=0;i<methods.length;i++){var method=methods[i];hightouchevents[method]=function(a){return function(){hightouchevents.push([a].concat(Array.prototype.slice.call(arguments)))}}(method)}hightouchevents.load(<WRITE_KEY>,<DATA_PLANE_URL>, {configUrl: <CONTROL_PLANE_URL>}),hightouchevents.page();
</script>

<script src="https://d1xt4zx4uzh8tq.cloudfront.net/latest/events.min.js"></script>
```

### Non-minified code

```html
<script>
  hightouchevents = window.hightouchevents = [];

  var methods = [
    'load',
    'page',
    'track',
    'identify',
    'alias',
    'group',
    'ready',
    'reset',
    'getAnonymousId',
    'setAnonymousId',
  ];

  for (var i = 0; i < methods.length; i++) {
    var method = methods[i];
    hightouchevents[method] = (function (methodName) {
      return function () {
        hightouchevents.push([methodName].concat(Array.prototype.slice.call(arguments)));
      };
    })(method);
  }
  hightouchevents.load(YOUR_WRITE_KEY, DATA_PLANE_URL, {
    configUrl: <CONTROL_PLANE_URL>,
  });
  //For example,
  //hightouchevents.load("1Qb1F3jSWv0eKFBPZcrM7ypgjVo", "http://localhost:8080", {
  //  configUrl: "http://localhost:8080,
  //});
  hightouchevents.page();
</script>

<script src="https://d1xt4zx4uzh8tq.cloudfront.net/latest/events.min.js"></script>
```

In all the above versions, there is an explicit `page` call at the end. This is added to ensure that whenever the SDK loads in a page, a `page` call is sent. You can remove this call completely or modify it with the extra page properties to suit your requirement. You can also add `page` calls in your application in places not tied directly to page load, e.g., virtual page views, page renders on route change such as in SPAs, etc.

### Write key and data plane URL

To integrate and initialize the JavaScript SDK, you will need the source write key and the data plane URL.

### Alternative installation using NPM

Although we recommend using the snippets mentioned above to use the JavaScript SDK with your website, you can also use this [**NPM module**](https://www.npmjs.com/package/@ht-sdks/events-sdk-js) to package the library directly into your project.

To install the SDK via npm, run the following command:

```bash
npm install @ht-sdks/events-sdk-js --save
```

**Note that this NPM module is only meant to be used for a browser installation**. If you want to integrate with your Node.js application, refer to the [**Node.js SDK**](https://github.com/ht-sdks/events-sdk-node).
<br><br>

**IMPORTANT**: Since the module exports the [**related APIs**](#exported-apis) on an already-defined object combined with the Node.js module caching, you should run the following code snippet only once and use the exported object throughout your project:

```javascript
import * as hightouchevents from "events-sdk-js";
hightouchevents.ready(() => {
  console.log("we are all set!!!");
});
hightouchevents.load(<WRITE_KEY>, <DATA_PLANE_URL>);
export { hightouchevents };
```

You can also do this with **ES5** using the `require` method, as shown:

```javascript
var hightouchevents = require("events-sdk-js");
hightouchevents.load(<WRITE_KEY>, <DATA_PLANE_URL>);
exports.hightouchevents = hightouchevents;
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
hightouchevents.identify(
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

In the above example, the user-related information like the `userId` and `email` is captured.

> There is no need to call `identify()` for anonymous visitors to your website. Such visitors are automatically assigned an `anonymousId`.

## Tracking user actions

The `track` call lets you record the customer events, i.e. the actions that they perform, along with any associated properties.

A sample `track` call is shown below:

```javascript
hightouchevents.track(
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

### How to build the SDK

- Look for run scripts in the `package.json` file for getting the browser minified and non-minified builds. The builds are updated in the `dist` folder of the directory. Among the others, some of the important ones are:

  - `npm run build:browser`: This outputs **events.min.js**.
  - `npm run build:npm`: This outputs **events-sdk-js** folder that contains the npm package contents.
  - `npm run build:integration:all`: This outputs **integrations** folder that contains the integrations.

> We use **rollup** to build our SDKs. The configuration for it is present in `rollup-configs` folder.

- For adding or removing integrations, modify the imports in `index.js` under the `src/integrations` folder.

### Usage in Chrome Extensions

The JS SDK can be used in Chrome Extensions with manifest v3, both as a content script or as a background script service worker.
