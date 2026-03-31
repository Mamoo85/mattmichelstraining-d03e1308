// OpenTelemetry instrumentation disabled — was causing infinite fetch loops
// that froze the application. The auto-instrumentation intercepted its own
// trace export requests, creating a runaway cycle.
export default {};
