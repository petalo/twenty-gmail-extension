/**
 * @file validation.js - Input validation and string normalization helpers.
 *
 * Contains validators for emails, API tokens, entity creation payloads, notes,
 * and activities, plus general-purpose string utilities used across the add-on.
 */

/**
 * @description Validates that a value is a well-formed email address.
 * @param {string} email - The value to check.
 * @returns {boolean} True if the value matches a basic email pattern.
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim().toLowerCase());
}

/**
 * @description Checks whether a value is a non-empty, non-whitespace string.
 * @param {*} value - The value to check.
 * @returns {boolean} True if value is a string with at least one non-whitespace character.
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * @description Trims a string value, returning empty string for non-string inputs.
 * @param {*} value - The value to normalize.
 * @returns {string} The trimmed string, or empty string if not a string type.
 */
function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @description Extracts a form field value from a Gmail add-on event object.
 * @param {Object} e - The Gmail add-on event object.
 * @param {string} fieldName - The form field name to read.
 * @returns {string} The trimmed field value, or empty string if absent.
 */
function getFormValue(e, fieldName) {
  if (!e || !e.formInput || !fieldName) {
    return "";
  }

  const rawValue = e.formInput[fieldName];
  if (Array.isArray(rawValue)) {
    return normalizeString(rawValue[0] || "");
  }

  return normalizeString(rawValue || "");
}

/**
 * @description Validates an API token string for basic format requirements.
 * @param {string} token - The API token to validate.
 * @returns {Object} An object with ok (boolean) and message (string) properties.
 */
function validateApiTokenInput(token) {
  if (!isNonEmptyString(token)) {
    return {
      ok: false,
      message: "API token is required."
    };
  }

  if (token.length < 20) {
    return {
      ok: false,
      message: "API token looks too short."
    };
  }

  return {
    ok: true,
    message: ""
  };
}

/**
 * @description Validates the payload for quick entity creation based on entity type.
 * @param {string} entityType - One of ENTITY_TYPES values (person, company, opportunity).
 * @param {Object} payload - The creation payload with name, email, domain, and relatedRecordRef fields.
 * @returns {Object} An object with ok (boolean) and message (string) properties.
 */
function validateQuickEntityInput(entityType, payload) {
  if (!Object.values(ENTITY_TYPES).includes(entityType)) {
    return {
      ok: false,
      message: "Invalid entity type."
    };
  }

  if (entityType === ENTITY_TYPES.PERSON) {
    if (!isValidEmail(payload.email)) {
      return { ok: false, message: "A valid email is required for person creation." };
    }
    if (!isNonEmptyString(payload.name)) {
      return { ok: false, message: "Name is required for person creation." };
    }
  }

  if (entityType === ENTITY_TYPES.COMPANY) {
    if (!isNonEmptyString(payload.name)) {
      return { ok: false, message: "Company name is required." };
    }
    if (!isNonEmptyString(payload.domain)) {
      return { ok: false, message: "Company domain is required." };
    }
  }

  if (entityType === ENTITY_TYPES.OPPORTUNITY) {
    if (!isNonEmptyString(payload.name)) {
      return { ok: false, message: "Opportunity name is required." };
    }
    if (!isNonEmptyString(payload.relatedRecordRef)) {
      return {
        ok: false,
        message: "A related person or company is required for opportunity creation."
      };
    }
  }

  return {
    ok: true,
    message: ""
  };
}

/**
 * @description Validates that a note has a body and a selected target entity.
 * @param {string} body - The note content.
 * @param {string} targetEntity - The selected target entity reference (type:id).
 * @returns {Object} An object with ok (boolean) and message (string) properties.
 */
function validateNoteInput(body, targetEntity) {
  if (!isNonEmptyString(targetEntity)) {
    return { ok: false, message: "You must select a target entity." };
  }
  if (!isValidTargetEntityRef(targetEntity)) {
    return { ok: false, message: "Selected target entity is invalid." };
  }

  if (!isNonEmptyString(body)) {
    return { ok: false, message: "Note content is required." };
  }

  return { ok: true, message: "" };
}

/**
 * @description Validates that an activity has a title and a selected target entity.
 * @param {string} title - The activity title.
 * @param {string} targetEntity - The selected target entity reference (type:id).
 * @param {string} dueDate - Optional due date in YYYY-MM-DD format.
 * @returns {Object} An object with ok (boolean) and message (string) properties.
 */
function validateActivityInput(title, targetEntity, dueDate) {
  if (!isNonEmptyString(targetEntity)) {
    return { ok: false, message: "You must select a target entity." };
  }
  if (!isValidTargetEntityRef(targetEntity)) {
    return { ok: false, message: "Selected target entity is invalid." };
  }

  if (!isNonEmptyString(title)) {
    return { ok: false, message: "Activity title is required." };
  }
  if (isNonEmptyString(dueDate) && !isIsoDateString(dueDate)) {
    return { ok: false, message: "Due date must use YYYY-MM-DD format." };
  }

  return { ok: true, message: "" };
}

/**
 * @description Checks if a target reference follows "entityType:id" format.
 * @param {string} value - Candidate reference value.
 * @returns {boolean} True when the reference is valid and supported.
 */
function isValidTargetEntityRef(value) {
  if (!isNonEmptyString(value)) {
    return false;
  }

  const parts = value.split(":");
  if (parts.length !== 2) {
    return false;
  }

  const entityType = parts[0];
  const entityId = parts[1];
  return Object.values(ENTITY_TYPES).includes(entityType) && isNonEmptyString(entityId);
}

/**
 * @description Validates YYYY-MM-DD date strings.
 * @param {string} value - Candidate date string.
 * @returns {boolean} True if the value matches YYYY-MM-DD and is a real calendar date.
 */
function isIsoDateString(value) {
  const normalized = normalizeString(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return false;
  }

  const date = new Date(normalized + "T00:00:00Z");
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return year + "-" + month + "-" + day === normalized;
}
