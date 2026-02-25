/**
 * @file logging.js - Structured logging utilities.
 *
 * Provides JSON-formatted log output with automatic redaction of sensitive
 * fields such as API tokens and authorization headers.
 */

/**
 * @description Generates a unique correlation identifier for request tracing.
 * @returns {string} A correlation ID in the format "cid-{timestamp}-{random}".
 */
function createCorrelationId() {
  return "cid-" + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

/**
 * @description Logs a structured INFO-level message to the console.
 * @param {string} actionName - The name of the action or operation being logged.
 * @param {Object} details - Additional context to include in the log entry.
 */
function logInfo(actionName, details) {
  const payload = {
    level: "INFO",
    actionName: actionName,
    timestamp: new Date().toISOString(),
    details: sanitizeLogObject(details || {})
  };

  console.log(JSON.stringify(payload));
}

/**
 * @description Logs a structured ERROR-level message to the console.
 * @param {string} actionName - The name of the action or operation that failed.
 * @param {Error|string} error - The error object or message string.
 * @param {Object} details - Additional context to include in the log entry.
 */
function logError(actionName, error, details) {
  const payload = {
    level: "ERROR",
    actionName: actionName,
    timestamp: new Date().toISOString(),
    errorMessage: error && error.message ? error.message : String(error),
    details: sanitizeLogObject(details || {})
  };

  console.error(JSON.stringify(payload));
}

/**
 * @description JSON-round-trip clones an object and redacts sensitive fields before logging.
 * @param {Object} input - The object to sanitize.
 * @returns {*} A sanitized copy with apiToken and Authorization header redacted.
 */
function sanitizeLogObject(input) {
  const clone = JSON.parse(JSON.stringify(input));

  if (!clone || typeof clone !== "object") {
    return clone;
  }

  if (clone.apiToken) {
    clone.apiToken = "[REDACTED]";
  }

  if (clone.headers && clone.headers.Authorization) {
    clone.headers.Authorization = "Bearer [REDACTED]";
  }

  return clone;
}
