import RudderMessage from './RudderMessage';
// Individual element class containing Rudder Message
class HtElement {
  constructor() {
    this.message = new RudderMessage();
  }

  // Setters that in turn set the field values for the contained object
  setType(type) {
    this.message.type = type;
  }

  setProperty(htProperty) {
    this.message.properties = htProperty;
  }

  setUserProperty(htUserProperty) {
    this.message.user_properties = htUserProperty;
  }

  setUserId(userId) {
    this.message.userId = userId;
  }

  setEventName(eventName) {
    this.message.event = eventName;
  }

  getElementContent() {
    return this.message;
  }
}
export default HtElement;
