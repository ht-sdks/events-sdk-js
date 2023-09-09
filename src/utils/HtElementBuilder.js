// Class responsible for building up the individual elements in a batch
// that is transmitted by the SDK
import HtElement from './HtElement';

class HtElementBuilder {
  constructor() {
    this.htProperty = null;
    this.htUserProperty = null;
    this.event = null;
    this.userId = null;
    this.type = null;
  }

  setType(eventType) {
    this.type = eventType;
    return this;
  }

  build() {
    const element = new HtElement();
    element.setUserId(this.userId);
    element.setType(this.type);
    element.setEventName(this.event);
    element.setProperty(this.htProperty);
    element.setUserProperty(this.htUserProperty);
    return element;
  }
}
export default HtElementBuilder;
