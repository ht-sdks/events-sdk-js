import * as utils from './util';

const productViewHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  utils.processEvent(htElement, 'prodView', pageName);
};

const productAddedHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  utils.processEvent(htElement, 'scAdd', pageName);
};

const productRemovedHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  utils.processEvent(htElement, 'scRemove', pageName);
};

const orderCompletedHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  const { properties } = htElement.message;
  const { purchaseId, transactionId, order_id: orderId } = properties;
  utils.updateWindowSKeys(purchaseId || orderId, 'purchaseID');
  utils.updateWindowSKeys(transactionId || orderId, 'transactionID');

  utils.processEvent(htElement, 'purchase', pageName);
};

const checkoutStartedHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  const { properties } = htElement.message;
  const { purchaseId, transactionId, order_id: orderId } = properties;
  utils.updateWindowSKeys(purchaseId || orderId, 'purchaseID');
  utils.updateWindowSKeys(transactionId || orderId, 'transactionID');

  utils.processEvent(htElement, 'scCheckout', pageName);
};

const cartViewedHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  utils.processEvent(htElement, 'scView', pageName);
};

const cartOpenedHandle = (htElement, pageName) => {
  utils.clearWindowSKeys(utils.getDynamicKeys());
  utils.processEvent(htElement, 'scOpen', pageName);
};

export {
  productViewHandle,
  productAddedHandle,
  productRemovedHandle,
  orderCompletedHandle,
  checkoutStartedHandle,
  cartViewedHandle,
  cartOpenedHandle,
};
