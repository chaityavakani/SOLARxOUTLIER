import { EventEmitter } from 'node:events';
import { logger } from './logger.js';

const bus = new EventEmitter();
bus.setMaxListeners(50);

/**
 * Registers a side-effect listener. Listeners run after the request response
 * is prepared (setImmediate) so a slow listener never delays the API.
 */
export function onEvent(name, handler) {
  bus.on(name, (payload) => {
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => logger.error({ err, event: name }, 'Event listener failed'));
  });
}

/**
 * Emits a domain event. Call this only AFTER the database transaction commits.
 */
export function emitEvent(name, payload) {
  setImmediate(() => bus.emit(name, payload));
}
