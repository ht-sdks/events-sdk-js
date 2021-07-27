// for sdk side native integration identification
// add a mapping from common names to index.js exported key names as identified by Rudder
const commonNames = {
  All: "All",
  "Google Analytics": "GA",
  GoogleAnalytics: "GA",
  GA: "GA",
  "Google Ads": "GOOGLEADS",
  GoogleAds: "GOOGLEADS",
  GOOGLEADS: "GOOGLEADS",
  Braze: "BRAZE",
  BRAZE: "BRAZE",
  Chartbeat: "CHARTBEAT",
  CHARTBEAT: "CHARTBEAT",
  Comscore: "COMSCORE",
  COMSCORE: "COMSCORE",
  Customerio: "CUSTOMERIO",
  "Customer.io": "CUSTOMERIO",
  "FB Pixel": "FACEBOOK_PIXEL",
  "Facebook Pixel": "FACEBOOK_PIXEL",
  FB_PIXEL: "FACEBOOK_PIXEL",
  "Google Tag Manager": "GOOGLETAGMANAGER",
  GTM: "GTM",
  Hotjar: "HOTJAR",
  hotjar: "HOTJAR",
  HOTJAR: "HOTJAR",
  Hubspot: "HS",
  HUBSPOT: "HS",
  Intercom: "INTERCOM",
  INTERCOM: "INTERCOM",
  Keen: "KEEN",
  "Keen.io": "KEEN",
  KEEN: "KEEN",
  Kissmetrics: "KISSMETRICS",
  KISSMETRICS: "KISSMETRICS",
  Lotame: "LOTAME",
  LOTAME: "LOTAME",
  "Visual Website Optimizer": "VWO",
  VWO: "VWO",
  OPTIMIZELY: "OPTIMIZELY",
  Optimizely: "OPTIMIZELY",
  FULLSTORY: "FULLSTORY",
  Fullstory: "FULLSTORY",
  FullStory: "FULLSTORY",
  BUGSNAG: "BUGSNAG",
  TVSQUARED: "TVSQUARED",
  "Google Analytics 4": "GA4",
  GoogleAnalytics4: "GA4",
  GA4: "GA4",
  MOENGAGE: "MoEngage",
  AM: "AM",
  AMPLITUDE: "AM",
  Amplitude: "AM",
  Pendo: "PENDO",
  PENDO: "PENDO",
  Lytics: "Lytics",
  LYTICS: "Lytics",
  Appcues: "APPCUES",
  APPCUES: "APPCUES",
  POSTHOG: "POSTHOG",
  PostHog: "POSTHOG",
  Posthog: "POSTHOG",
  KLAVIYO: "KLAVIYO",
  Klaviyo: "KLAVIYO",
  CLEVERTAP: "CLEVERTAP",
  Clevertap: "CLEVERTAP",
  BingAds: "BINGADS",
  PinterestTag: "PINTEREST_TAG",
  Pinterest_Tag: "PINTEREST_TAG",
  PINTERESTTAG: "PINTEREST_TAG",
  PINTEREST_TAG: "PINTEREST_TAG",
  pinterest: "PINTEREST_TAG",
  PinterestAds: "PINTEREST_TAG",
  Pinterest_Ads: "PINTEREST_TAG",
  Pinterest: "PINTEREST_TAG",
  "Adobe Analytics": "ADOBE_ANALYITCS",
  ADOBE_ANALYTICS: "ADOBE_ANALYTICS",
  AdobeAnalytics: "ADOBE_ANALYTICS",
  adobeanalytics: "ADOBE_ANALYTICS",
  "LinkedIn Insight Tag": "LINKEDIN_INSIGHT_TAG",
  LINKEDIN_INSIGHT_TAG: "LINKEDIN_INSIGHT_TAG",
  Linkedin_insight_tag: "LINKEDIN_INSIGHT_TAG",
  LinkedinInsighttag: "LINKEDIN_INSIGHT_TAG",
  LinkedinInsightTag: "LINKEDIN_INSIGHT_TAG",
  LinkedInInsightTag: "LINKEDIN_INSIGHT_TAG",
  Linkedininsighttag: "LINKEDIN_INSIGHT_TAG",
  LINKEDININSIGHTTAG: "LINKEDIN_INSIGHT_TAG",
  Reddit_Pixel: "REDDIT_PIXEL",
  RedditPixel: "REDDIT_PIXEL",
  REDDITPIXEL: "REDDIT_PIXEL",
  redditpixel: "REDDIT_PIXEL",
  "Reddit Pixel": "REDDIT_PIXEL",
  "REDDIT PIXEL": "REDDIT_PIXEL",
  "reddit pixel": "REDDIT_PIXEL",
  Heap: "HEAP",
  heap: "HEAP",
  "Heap.io": "HEAP",
  HEAP: "HEAP",
};

export { commonNames };
