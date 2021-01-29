## WIP

This API is still a WIP. Feedbacks are welcome.

This section will serve as a gathering for all ideas we want to implement or that are open to discussion in this module.

### Ideas

- Dual logging system:
  - A highly performant core integrated with hapi's core:
    - Super fast text streams (inspired from pino)
    - Replace the current `server.log()` and `request.log()`, maybe by something like `server.log.critical()`, `request.log.debug()`.
    - Should we allow for custom log levels?
    - Allow data to be bind to a logger to create a "child logger" rather than having to do it by hand every time.
    - Allow for default log level and minimum log level threshold.
    - A documented log format that would enable logging to `stdout` / `stderr` from hapi and piping them to another process for more in depth handling (reformating, shipping, etc.).
  - Podium API to subscribe to specific events and a built-in way to pipe everything to stdout.
- Plugins could add support for writing to files with additional features like files rotation, chunking or write to HTTP targets i.e loggly.
- Rework the current `server.events` and `request.events` channels to make them more intuitive :
  - Remove the ambiguity with the `request` event where it makes you think that an event will be triggered when a new request is received whereas it can be done with the `onRequest` extension point instead.
  - Remove the inconsistency between `server.log()` which emits `log` events and `request.log()` which emits `request` events.
- Keep emitting events when logging (to enable side usage like crash notifications ala Sentry).
- Provide first class API to serialize problematic Node/hapi objects such as the request object using either first class citizen objects or methods like `toJSON()` :
  - Allow the user to provide paths to data or a redaction function for sensitive information.
- Built in support for ignoring events based on path or tags i.e `/health`.

## Log level

This module provides different log levels:

- `emergency (0)`: System is unusable
- `alert (1)`: Should be corrected immediately
- `critical (2)`: Critical conditions
- `error (3)`: Error conditions
- `warning (4)`: May indicate that an error will occur if action is not taken
- `notice (5)`: Events that are unusual, but not error conditions
- `info (6)`: Normal operational messages that require no action
- `debug (7)`: Information useful to developers for debugging the application
