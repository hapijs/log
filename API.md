## WIP

This API is still a WIP. Feedbacks are welcome.

### Ideas

This section will serve as a gathering for all ideas we want to implement or that are open to discussion in this module.

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

## <a name="log-level" /> Log level

This module provides different log levels:

- `emergency (0)`: System is unusable
- `alert (1)`: Should be corrected immediately
- `critical (2)`: Critical conditions
- `error (3)`: Error conditions
- `warning (4)`: May indicate that an error will occur if action is not taken
- `notice (5)`: Events that are unusual, but not error conditions
- `info (6)`: Normal operational messages that require no action
- `debug (7)`: Information useful to developers for debugging the application

## <a name="registration" /> Registration

This plugin accepts several options:

### <a name="register.additionalFields" /> `additionalFields`

Default value: `{}`.

A free form object that will be passed to the log function for every elements in [events](#register.events).

### <a name="register.defaultLevel" /> `defaultLevel`

Default value: [`'info'`](#log-level).

A [log level](#log-level) string that will be used as the level for the automatic logging performed on [events](#register.events).

### <a name="register.events" /> `events`

Default value: `['log', 'onRequest', 'request', 'response', 'start', 'stop']`.

An array of strings where each value represents the name of an event dispatched by `hapi` or a request lifecycle method. This plugin will log information for all events/lifecycle in this array. The available values are:

- `log` event
- `onRequest` lifecycle
- `request` event
- `response` event
- `start` event
- `stop` event
  - The logger will automatically be closed upon `stop` event reception whether it is present in the `events` array or not.

The automatic logging behavior on `log` and `request` event is handled differently from the other. If the received event object contains tags, they will be tested against the [log levels](#log-levels). If there are matches and a matched log level has a more severe log level than the [default level](#register.defaultLevel) it will be used instead. When multiple tags match, the one with the most severe log level will be used. If there are no matches, the [default level](#register.defaultLevel) will be used.

### <a name="register.ignoreChannels" /> `ignoreChannels`

Default value: `[]`.

An array of strings whose values are event channels to exclude from logging. These channels will be matched against the channel of the received event object from:

- `log` event
- `request` event

### <a name="register.ignorePaths" /> `ignorePaths`

Default value: `[]`.

An array of strings whose values are route paths to exclude from logging. This option is used only for:

- `request` event
- `response` event
- `onRequest` lifecycle

### <a name="register.ignoreTags" /> `ignoreTags`

Default value: `[]`.

An array of strings whose values are tags to exclude from logging. Event tags and routes tags will be matched against this option. No log will be performed as long as at least one tag matches from this option. Tags from `log` and `request` events will be checked. Route tags filtering will be performed for requests on `request`, `response` event and `onRequest` lifecycle.

### <a name="register.level" /> `level`

Default value: [`'info'`](#log-level).

A [log level](#log-level) string used to determine the maximum log level allowed, meaning the log level with the highest numerical value allowed. For example let's say you defined this option as `level: 'notice'`, whose numerical value is `5`. Afterwards a `log` event is intercepted by this plugin whose tags contain `'debug'` matching with the 8th log level (`debug (7)`). This event will not be logged since its numerical value is higher than the numerical value of this option.
