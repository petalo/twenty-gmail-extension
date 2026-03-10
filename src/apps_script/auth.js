/**
 * @file auth.js - Authentication and per-user storage management.
 *
 * Handles API token persistence, validation against the Twenty API,
 * and a small MRU cache of recently-used companies per user.
 */

/**
 * @description Returns a lowercase key that uniquely identifies the current user.
 * @returns {string} The current user's email in lowercase.
 */
function getCurrentUserKey() {
  return getCurrentUserEmailSafe().toLowerCase();
}

/**
 * @description Builds the UserProperties key for storing the API token.
 * @returns {string} A namespaced property key for the current user's token.
 */
function getUserTokenPropertyKey() {
  return USER_TOKEN_PROPERTY_NAMESPACE + ":" + getCurrentUserKey();
}

/**
 * @description Builds the UserProperties key for storing the workspace app URL.
 * @returns {string} A namespaced property key for the current user's workspace URL.
 */
function getUserAppUrlPropertyKey() {
  return USER_APP_URL_PROPERTY_NAMESPACE + ":" + getCurrentUserKey();
}

/**
 * @description Retrieves the stored Twenty workspace URL for the current user.
 * @returns {string} The workspace URL, or the TWENTY_APP_URL fallback if not set.
 */
function getUserAppUrl() {
  const stored = normalizeString(
    PropertiesService.getUserProperties().getProperty(getUserAppUrlPropertyKey())
  );
  return stored || TWENTY_APP_URL;
}

/**
 * @description Persists a Twenty workspace URL in UserProperties for the current user.
 * @param {string} url - The workspace URL to save.
 */
function saveUserAppUrl(url) {
  PropertiesService.getUserProperties().setProperty(getUserAppUrlPropertyKey(), url);
}

/**
 * @description Removes the stored workspace URL for the current user.
 */
function clearUserAppUrl() {
  PropertiesService.getUserProperties().deleteProperty(getUserAppUrlPropertyKey());
}

/**
 * @description Builds the UserProperties key for storing recent companies.
 * @returns {string} A namespaced property key for the current user's recent companies.
 */
function getRecentCompaniesPropertyKey() {
  return USER_RECENT_COMPANIES_PROPERTY_NAMESPACE + ":" + getCurrentUserKey();
}

/**
 * @description Generates a cache key derived from a SHA-256 fingerprint of the token.
 * @param {string} token - The API token to fingerprint.
 * @returns {string} A cache key like "token-validation:{hex}", or empty string if blank.
 */
function buildTokenValidationCacheKey(token) {
  if (!isNonEmptyString(token)) {
    return "";
  }

  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token);
  const fingerprint = digest
    .map((byte) => {
      const normalized = byte < 0 ? byte + 256 : byte;
      return ("0" + normalized.toString(16)).slice(-2);
    })
    .join("");

  return "token-validation:" + fingerprint;
}

/**
 * @description Retrieves the stored Twenty API token for the current user.
 * @returns {string} The API token, or empty string if not set.
 */
function getUserApiToken() {
  const value = PropertiesService.getUserProperties().getProperty(getUserTokenPropertyKey());
  return normalizeString(value);
}

/**
 * @description Persists a Twenty API token in UserProperties for the current user.
 * @param {string} token - The API token to save.
 */
function saveUserApiToken(token) {
  PropertiesService.getUserProperties().setProperty(getUserTokenPropertyKey(), token);
}

/**
 * @description Removes the stored API token for the current user.
 */
function clearUserApiToken() {
  PropertiesService.getUserProperties().deleteProperty(getUserTokenPropertyKey());
}

/**
 * @description Loads the list of recently-used companies from UserProperties.
 * @returns {Array<Object>} An array of company objects with id, name, and domain fields.
 */
function loadRecentCompanies() {
  const raw = PropertiesService.getUserProperties().getProperty(getRecentCompaniesPropertyKey());
  if (!isNonEmptyString(raw)) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item) => item && isNonEmptyString(item.id))
      .map((item) => ({
        id: String(item.id),
        name: normalizeString(item.name),
        domain: normalizeString(item.domain)
      }));
  } catch (error) {
    logError("loadRecentCompanies", error, { correlationId: "recent-companies" });
    return [];
  }
}

/**
 * @description Saves a list of recent companies to UserProperties, capped at RECENT_COMPANIES_LIMIT.
 * @param {Array<Object>} companies - Company objects with id, name, and domain fields.
 */
function saveRecentCompanies(companies) {
  const normalized = (companies || [])
    .filter((company) => company && isNonEmptyString(company.id))
    .map((company) => ({
      id: String(company.id),
      name: normalizeString(company.name),
      domain: normalizeString(company.domain)
    }))
    .slice(0, RECENT_COMPANIES_LIMIT);

  PropertiesService.getUserProperties().setProperty(
    getRecentCompaniesPropertyKey(),
    JSON.stringify(normalized)
  );
}

/**
 * @description Adds or promotes a company to the front of the recent companies list.
 * @param {Object} company - A company object with id, name, and domain fields.
 */
function rememberRecentCompany(company) {
  if (!company || !isNonEmptyString(company.id)) {
    return;
  }

  const recent = loadRecentCompanies();
  const entry = {
    id: String(company.id),
    name: normalizeString(company.name),
    domain: normalizeString(company.domain)
  };
  const filtered = recent.filter((item) => item.id !== entry.id);
  filtered.unshift(entry);
  saveRecentCompanies(filtered);
}

/**
 * @description Validates an API token by making a lightweight request to the Twenty API.
 *
 * Uses a short-lived cache to avoid redundant validation requests within the
 * same session. Returns a result object compatible with the UI error flow.
 *
 * @param {string} token - The API token to validate.
 * @returns {Object} An object with ok, message, reason, statusCode, and
 *   shouldClearToken fields for downstream auth/error handling.
 */
function validateApiToken(token) {
  const check = validateApiTokenInput(token);
  if (!check.ok) {
    return {
      ok: false,
      message: check.message,
      reason: "invalid_input",
      statusCode: 0,
      shouldClearToken: true
    };
  }

  const cacheKey = buildTokenValidationCacheKey(token);
  const cache = CacheService.getUserCache();
  if (cacheKey && cache.get(cacheKey) === "ok") {
    return {
      ok: true,
      message: "",
      reason: "ok",
      statusCode: 200,
      shouldClearToken: false
    };
  }

  try {
    const response = requestTwenty(
      "/rest/people?limit=1",
      {
        method: HTTP_METHOD.GET,
        muteHttpExceptions: true
      },
      token
    );

    if (!response.ok) {
      if (response.statusCode === 401 || response.statusCode === 403) {
        return {
          ok: false,
          message: "Token is invalid or expired.",
          reason: "invalid_token",
          statusCode: response.statusCode,
          shouldClearToken: true
        };
      }

      if (response.statusCode === 429) {
        return {
          ok: false,
          message: "Twenty API rate limit reached. Try again shortly.",
          reason: "rate_limited",
          statusCode: response.statusCode,
          shouldClearToken: false
        };
      }

      return {
        ok: false,
        message: "Unable to validate token right now.",
        reason: "api_error",
        statusCode: response.statusCode || 0,
        shouldClearToken: false
      };
    }

    if (cacheKey) {
      cache.put(cacheKey, "ok", TOKEN_VALIDATION_CACHE_TTL_SECONDS);
    }

    return {
      ok: true,
      message: "",
      reason: "ok",
      statusCode: response.statusCode,
      shouldClearToken: false
    };
  } catch (error) {
    logError("validateApiToken", error, {});
    return {
      ok: false,
      message: "Unable to validate token right now.",
      reason: "network_error",
      statusCode: 0,
      shouldClearToken: false
    };
  }
}
