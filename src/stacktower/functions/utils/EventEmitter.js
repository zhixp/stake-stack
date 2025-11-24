export default class EventEmitter {
  constructor() {
    this.listeners = {};
  }

  on(eventName, fn) {
    if (!this.listeners[eventName]) {
      this.listeners[eventName] = [];
    }
    this.listeners[eventName].push(fn);
  }

  off(eventName, fn) {
    if (!this.listeners[eventName]) return;
    this.listeners[eventName] = this.listeners[eventName].filter((f) => f !== fn);
  }

  trigger(eventName, args = []) {
    if (!this.listeners[eventName]) return;
    for (const fn of this.listeners[eventName]) {
      fn(...args);
    }
  }
}
