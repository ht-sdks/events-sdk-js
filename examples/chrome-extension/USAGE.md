# Chrome Extension Usage

The JS SDK can be used in Chrome Extensions with manifest v3, both as a content script or as a background script
service worker.

## Table of contents

- [**Examples**](#examples)
- [**Background Script**](#background-script)
- [**Content Script**](#content-script)

## Examples

The provided examples are based on [Chrome Extension v3 Starter](https://github.com/SimGus/chrome-extension-v3-starter)
that contains a minimal Chrome/Chromium extension using the newest version of the manifest (v3).

## Background Script

The npm package has a service worker export that can be used as a background script. You will need to
place it in your Chrome extension resources, either by copying the file from node modules--having it as part of your
resources--or by using a JS bundler.

Relevant permissions need to be enabled in the manifest file as per the desired capabilities and connections allowed.
Additionally setting the background script type as module will allow you to import is as ESM.

    "permissions": ["storage", "tabs"],
    "host_permissions": [
        "https://*.*.hightouch.com/*",
        "https://*.hightouch.com/*",
        "*://*/*"
    ],
    "externally_connectable": {
        "matches": [
            "https://*.*.hightouch.com/*",
            "https://*.hightouch.com/*"
        ]
    },
    "background": {
        "service_worker": "service-worker.js",
        "type": "module"
    },

After that you should be able to follow the NodeJS SDK documentation for further usage.

You can react to events that are available in background scripts via the [Chrome API](https://developer.chrome.com/docs/extensions/reference/).

Here is an example to track url changes.

Sample background script imports:

    # In case file is copied from node_modules/@ht-sdks/events-sdk-js/service-worker/index.es.js in extension resources folder
    import { Analytics } from "./rudderAnalytics.js";

    # In case the package is imported directly as umd and then bundled in the background script
    import { Analytics } from "@ht-sdks/events-sdk-js/service-worker";

    # In case the package is imported directly as es-module and then bundled in the background script
    import { Analytics } from "@ht-sdks/events-sdk-js/service-worker/index.es";

Sample background script:

    const hightouchClient = new Analytics("<writeKey>","<dataPlaneURL>/v1/batch", {configUrl: <controlPlaneUrl>});

    chrome.tabs.onUpdated.addListener((tabId, tab) => {
        if (tab.url) {
            hightouchClient.track({
                userId: "123456",
                event: "Event Name",
                properties: {
                    data: { url: tab.url },
                }
            });
        }
    });

## Content Script

The SDK can also be used as a content script. Place it in your Chrome extension resources, either by downloading the file or by using a JS bundler and bundling it as part of your content script.

Relevant permissions need to be enabled in the manifest file as per the desired capabilities and connections allowed

    "permissions": ["storage", "tabs"],
    "host_permissions": [
        "https://*.*.hightouch.com/*",
        "https://*.hightouch.com/*",
        "*://*/*"
    ],
    "externally_connectable": {
        "matches": [
            "https://*.*.hightouch.com/*",
            "https://*.hightouch.com/*"
        ]
    }

After that you should be able to follow the JS SDK documentation for further usage.

You can react to events that are available in both content and background scripts too via the [Chrome API](https://developer.chrome.com/docs/extensions/reference/).

Here is an example to track url changes.

Sample content script:

    # prepend the JS SDK file here
    analytics.load("<writeKey>", "<dataPlaneURL>", {configUrl: <controlPlaneUrl>});

    chrome.runtime.onMessage.addListener((obj, sender, response) => {
        const { type, value } = obj;

        if (type === "trackURL") {
            analytics.track("URL change", { url: value });
        }
    });

Sample background script:

    chrome.tabs.onUpdated.addListener((tabId, tab) => {
        if (tab.url) {
            chrome.tabs.sendMessage(tabId, {
                type: "trackURL",
                value: {
                    url: tab.url
                },
            });
        }
    });

## External resources

- [Official feature summary for manifest v3](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-overview/)
- [Migrating from v2 to v3](https://developer.chrome.com/docs/extensions/mv3/intro/mv3-migration/) + [very useful checklist once you think you are done](https://developer.chrome.com/docs/extensions/mv3/mv3-migration-checklist/)
- [Excellent write-ups of a migration](https://github.com/kentbrew/learning-manifest-v3)
