/**
 * @file twenty_client.js - Twenty CRM REST API client.
 *
 * Provides HTTP request helpers and CRUD operations for people, companies,
 * opportunities, notes, and tasks against the Twenty REST API. Includes
 * response parsing, record extraction, and domain/email matching utilities.
 */

/**
 * @description Sends an authenticated HTTP request to the Twenty REST API.
 * @param {string} path - The API endpoint path (e.g. "/rest/people").
 * @param {Object} requestOptions - Options with method, payload, and muteHttpExceptions fields.
 * @param {string} apiToken - The Bearer token for authentication.
 * @returns {Object} A result with ok, statusCode, data, and rawBody fields.
 * @throws {Error} Re-throws fetch errors after logging.
 */
function requestTwenty(path, requestOptions, apiToken) {
  const url = TWENTY_BASE_URL + path;
  const method = (requestOptions && requestOptions.method) || HTTP_METHOD.GET;
  const requestLogDetails = buildRequestLogDetails(path, method);

  const fetchOptions = {
    method: method,
    muteHttpExceptions: Boolean(requestOptions && requestOptions.muteHttpExceptions),
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + apiToken
    }
  };

  if (requestOptions && requestOptions.payload) {
    fetchOptions.payload = JSON.stringify(requestOptions.payload);
  }

  try {
    const startedAt = Date.now();
    const response = UrlFetchApp.fetch(url, fetchOptions);
    const latencyMs = Date.now() - startedAt;
    const statusCode = response.getResponseCode();
    const body = response.getContentText() || "";
    const data = tryParseJson(body);

    logInfo("requestTwenty", {
      endpoint: requestLogDetails.endpoint,
      method: requestLogDetails.method,
      queryKeys: requestLogDetails.queryKeys,
      statusCode: statusCode,
      latencyMs: latencyMs
    });

    return {
      ok: statusCode >= 200 && statusCode < 300,
      statusCode: statusCode,
      data: data,
      rawBody: body
    };
  } catch (error) {
    logError("requestTwenty", error, requestLogDetails);
    throw error;
  }
}

/**
 * @description Builds a sanitized log payload for a Twenty API request.
 *
 * Includes endpoint and query parameter keys only. Query values are excluded
 * to avoid leaking PII such as emails or domains in logs.
 *
 * @param {string} path - The request path with optional query string.
 * @param {string} method - The HTTP method.
 * @returns {Object} A sanitized log object with endpoint, method, and queryKeys.
 */
function buildRequestLogDetails(path, method) {
  const normalizedPath = normalizeString(path);
  const pathParts = normalizedPath.split("?");
  const endpointPath = pathParts[0] || "";
  const queryString = pathParts.length > 1 ? pathParts.slice(1).join("?") : "";
  const queryKeys = queryString
    .split("&")
    .map((entry) => normalizeString(entry.split("=")[0]))
    .filter((key) => key.length > 0);

  return {
    endpoint: TWENTY_BASE_URL + endpointPath,
    method: method,
    queryKeys: dedupeStrings(queryKeys)
  };
}

/**
 * @description Finds a person record by email address, trying multiple filter strategies.
 * @param {string} email - The email address to search for.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data fields.
 */
function findPersonByEmail(email, apiToken) {
  if (!isValidEmail(email)) {
    return emptySuccessResult();
  }

  const normalizedEmail = normalizeEmailValue(email);
  const filters = ["emails.primaryEmail[eq]:" + normalizedEmail, "email[eq]:" + normalizedEmail];

  for (let i = 0; i < filters.length; i += 1) {
    const filteredResponse = requestTwenty(
      "/rest/people?limit=5&filter=" + encodeURIComponent(filters[i]),
      { method: HTTP_METHOD.GET, muteHttpExceptions: true },
      apiToken
    );

    if (filteredResponse.statusCode === 429) {
      return filteredResponse;
    }

    if (!filteredResponse.ok) {
      continue;
    }

    if (extractRecords(filteredResponse.data).length > 0) {
      return filteredResponse;
    }
  }

  return emptySuccessResult();
}

/**
 * @description Finds company records matching a domain, trying primaryLinkUrl and websiteUrl filters.
 * @param {string} domain - The domain to search for (e.g. "acme.com").
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data fields.
 */
function findCompanyByDomain(domain, apiToken) {
  if (!isNonEmptyString(domain)) {
    return emptySuccessResult();
  }

  const normalizedDomain = normalizeDomainValue(domain);
  const filters = [
    "domainName.primaryLinkUrl[ilike]:%" + normalizedDomain + "%",
    "websiteUrl[ilike]:%" + normalizedDomain + "%"
  ];

  for (let i = 0; i < filters.length; i += 1) {
    const filteredResponse = requestTwenty(
      "/rest/companies?limit=5&filter=" + encodeURIComponent(filters[i]),
      { method: HTTP_METHOD.GET, muteHttpExceptions: true },
      apiToken
    );

    if (filteredResponse.statusCode === 429) {
      return filteredResponse;
    }

    if (!filteredResponse.ok) {
      continue;
    }

    if (extractRecords(filteredResponse.data).length > 0) {
      return filteredResponse;
    }
  }

  return emptySuccessResult();
}

/**
 * @description Searches for companies by a free-text query matching name or domain.
 *
 * Tries filtered API requests first, then falls back to client-side filtering
 * of a broader result set if no matches are found.
 *
 * @param {string} query - The search text (minimum 3 characters).
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data (array of companies).
 */
function searchCompaniesByQuery(query, apiToken) {
  const normalizedQuery = normalizeString(query).toLowerCase();
  if (normalizedQuery.length < 3) {
    return emptySuccessResult();
  }

  const filters = ["name[ilike]:%" + normalizedQuery + "%"];
  if (
    normalizedQuery.indexOf(".") !== -1 ||
    normalizedQuery.indexOf("@") !== -1 ||
    normalizedQuery.indexOf("http") !== -1
  ) {
    filters.push("domainName.primaryLinkUrl[ilike]:%" + normalizedQuery + "%");
    filters.push("websiteUrl[ilike]:%" + normalizedQuery + "%");
  }

  const allRecords = [];
  let sawRateLimit = false;

  filters.forEach((filter) => {
    const response = requestTwenty(
      "/rest/companies?limit=20&filter=" + encodeURIComponent(filter),
      { method: HTTP_METHOD.GET, muteHttpExceptions: true },
      apiToken
    );

    if (response.statusCode === 429) {
      sawRateLimit = true;
      return;
    }

    if (!response.ok) {
      return;
    }

    allRecords.push.apply(allRecords, extractRecords(response.data));
  });

  const deduped = dedupeById(allRecords);
  if (deduped.length > 0) {
    return {
      ok: true,
      statusCode: 200,
      data: deduped
    };
  }

  if (sawRateLimit) {
    return {
      ok: false,
      statusCode: 429,
      data: []
    };
  }

  const fallbackResponse = requestTwenty(
    "/rest/companies?limit=100",
    { method: HTTP_METHOD.GET, muteHttpExceptions: true },
    apiToken
  );
  if (!fallbackResponse.ok) {
    return fallbackResponse;
  }

  const filteredCompanies = extractRecords(fallbackResponse.data).filter((company) =>
    companyMatchesQuery(company, normalizedQuery)
  );

  return {
    ok: true,
    statusCode: 200,
    data: dedupeById(filteredCompanies)
  };
}

/**
 * @description Finds a company by its unique ID.
 * @param {string} companyId - The company record ID.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data fields.
 */
function findCompanyById(companyId, apiToken) {
  if (!isNonEmptyString(companyId)) {
    return emptySuccessResult();
  }

  const filter = "id[eq]:" + companyId;
  const path = "/rest/companies?limit=1&filter=" + encodeURIComponent(filter);
  return requestTwenty(path, { method: HTTP_METHOD.GET, muteHttpExceptions: true }, apiToken);
}

/**
 * @description Lists opportunities linked to a person or company target.
 * @param {string} targetType - The entity type ("person" or "company").
 * @param {string} targetId - The target entity's ID.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data (array of opportunities).
 */
function listOpportunitiesByTarget(targetType, targetId, apiToken) {
  if (!isNonEmptyString(targetType) || !isNonEmptyString(targetId)) {
    return emptySuccessResult();
  }

  const fieldNames =
    targetType === ENTITY_TYPES.PERSON ? ["pointOfContactId", "personId"] : ["companyId"];
  const allRecords = [];
  let sawRateLimit = false;

  fieldNames.forEach((fieldName) => {
    const filter = fieldName + "[eq]:" + targetId;
    const path = "/rest/opportunities?limit=20&filter=" + encodeURIComponent(filter);
    const response = requestTwenty(
      path,
      { method: HTTP_METHOD.GET, muteHttpExceptions: true },
      apiToken
    );

    if (response.statusCode === 429) {
      sawRateLimit = true;
      return;
    }

    if (!response.ok) {
      return;
    }

    allRecords.push.apply(allRecords, extractRecords(response.data));
  });

  if (sawRateLimit && allRecords.length === 0) {
    return {
      ok: false,
      statusCode: 429,
      data: []
    };
  }

  return {
    ok: true,
    statusCode: 200,
    data: dedupeById(allRecords)
  };
}

/**
 * @description Creates a person record in Twenty CRM.
 * @param {Object} payload - The creation payload with name, email, and optional companyId.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data fields.
 */
function createQuickPerson(payload, apiToken) {
  const parsedName = splitName(payload.name);
  return requestTwenty(
    "/rest/people",
    {
      method: HTTP_METHOD.POST,
      payload: {
        name: {
          firstName: parsedName.firstName,
          lastName: parsedName.lastName
        },
        emails: {
          primaryEmail: payload.email
        },
        companyId: payload.companyId || null
      },
      muteHttpExceptions: true
    },
    apiToken
  );
}

/**
 * @description Creates a company record in Twenty CRM.
 * @param {Object} payload - The creation payload with name and domain.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data fields.
 */
function createQuickCompany(payload, apiToken) {
  const domainUrl = toUrl(payload.domain);
  return requestTwenty(
    "/rest/companies",
    {
      method: HTTP_METHOD.POST,
      payload: {
        name: payload.name,
        domainName: {
          primaryLinkUrl: domainUrl
        }
      },
      muteHttpExceptions: true
    },
    apiToken
  );
}

/**
 * @description Creates an opportunity record in Twenty CRM with an optional related entity.
 * @param {Object} payload - The creation payload with name and relatedRecordRef.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response with ok, statusCode, and data fields.
 */
function createQuickOpportunity(payload, apiToken) {
  const related = parseRelatedTarget(payload.relatedRecordRef);
  const relationPayload = {};

  if (related.type === ENTITY_TYPES.PERSON) {
    relationPayload.pointOfContactId = related.id;
  }
  if (related.type === ENTITY_TYPES.COMPANY) {
    relationPayload.companyId = related.id;
  }

  return requestTwenty(
    "/rest/opportunities",
    {
      method: HTTP_METHOD.POST,
      payload: Object.assign(
        {
          name: payload.name
        },
        relationPayload
      ),
      muteHttpExceptions: true
    },
    apiToken
  );
}

/**
 * @description Creates a note with a target link in Twenty CRM.
 *
 * First creates the note record, then creates a noteTarget linking it
 * to the specified person, company, or opportunity.
 *
 * @param {Object} payload - The note payload with title, body, targetType, and targetId.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response from the noteTarget creation step, or {ok: false, rollbackAttempted, rollbackOk} on link failure, or {ok: false, statusCode: 400} on missing IDs.
 */
function createNote(payload, apiToken) {
  const createNoteResponse = requestTwenty(
    "/rest/notes",
    {
      method: HTTP_METHOD.POST,
      payload: {
        title: payload.title || "",
        bodyV2: {
          markdown: payload.body
        }
      },
      muteHttpExceptions: true
    },
    apiToken
  );

  if (!createNoteResponse.ok) {
    return createNoteResponse;
  }

  const noteId = extractCreatedEntityId(createNoteResponse.data, "createNote");
  const targetPayload = buildTargetPayload(payload.targetType, payload.targetId);
  if (!noteId || !targetPayload) {
    return {
      ok: false,
      statusCode: 400,
      data: null
    };
  }

  const linkResponse = requestTwenty(
    "/rest/noteTargets",
    {
      method: HTTP_METHOD.POST,
      payload: Object.assign(
        {
          noteId: noteId
        },
        targetPayload
      ),
      muteHttpExceptions: true
    },
    apiToken
  );

  if (linkResponse.ok) {
    return linkResponse;
  }

  const rollbackResponse = rollbackCreatedEntity("notes", noteId, apiToken);
  return {
    ok: false,
    statusCode: linkResponse.statusCode || 500,
    data: linkResponse.data,
    rollbackAttempted: true,
    rollbackOk: rollbackResponse.ok
  };
}

/**
 * @description Creates a task (activity) with a target link in Twenty CRM.
 *
 * First creates the task record with TODO status, then creates a taskTarget
 * linking it to the specified person, company, or opportunity.
 *
 * @param {Object} payload - The activity payload with title, dueDate, body, targetType, and targetId.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} An API response from the taskTarget creation step, or {ok: false, rollbackAttempted, rollbackOk} on link failure, or {ok: false, statusCode: 400} on missing IDs.
 */
function createActivity(payload, apiToken) {
  const createTaskResponse = requestTwenty(
    "/rest/tasks",
    {
      method: HTTP_METHOD.POST,
      payload: {
        title: payload.title,
        bodyV2: {
          markdown: payload.body || ""
        },
        dueAt: payload.dueDate || null,
        status: TASK_STATUS.TODO
      },
      muteHttpExceptions: true
    },
    apiToken
  );

  if (!createTaskResponse.ok) {
    return createTaskResponse;
  }

  const taskId = extractCreatedEntityId(createTaskResponse.data, "createTask");
  const targetPayload = buildTargetPayload(payload.targetType, payload.targetId);
  if (!taskId || !targetPayload) {
    return {
      ok: false,
      statusCode: 400,
      data: null
    };
  }

  const linkResponse = requestTwenty(
    "/rest/taskTargets",
    {
      method: HTTP_METHOD.POST,
      payload: Object.assign(
        {
          taskId: taskId
        },
        targetPayload
      ),
      muteHttpExceptions: true
    },
    apiToken
  );

  if (linkResponse.ok) {
    return linkResponse;
  }

  const rollbackResponse = rollbackCreatedEntity("tasks", taskId, apiToken);
  return {
    ok: false,
    statusCode: linkResponse.statusCode || 500,
    data: linkResponse.data,
    rollbackAttempted: true,
    rollbackOk: rollbackResponse.ok
  };
}

/**
 * @description Attempts to delete a newly-created entity when a follow-up link action fails.
 * @param {string} objectName - The REST object collection name (e.g. "notes", "tasks").
 * @param {string} entityId - The ID of the record to delete.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} Delete response with ok and statusCode fields.
 */
function rollbackCreatedEntity(objectName, entityId, apiToken) {
  if (!isNonEmptyString(objectName) || !isNonEmptyString(entityId)) {
    return {
      ok: false,
      statusCode: 0,
      data: null
    };
  }

  try {
    return requestTwenty(
      "/rest/" + objectName + "/" + encodeURIComponent(entityId),
      {
        method: HTTP_METHOD.DELETE,
        muteHttpExceptions: true
      },
      apiToken
    );
  } catch (error) {
    logError("rollbackCreatedEntity", error, {
      objectName: objectName,
      entityId: entityId
    });
    return {
      ok: false,
      statusCode: 0,
      data: null
    };
  }
}

/**
 * @description Extracts an array of records from a Twenty API response in various formats.
 *
 * Handles direct arrays, data.items, data.nodes, data.edges, and nested
 * object structures to accommodate different Twenty API response shapes.
 *
 * @param {*} responseData - The parsed response body from a Twenty API call.
 * @returns {Array<Object>} An array of entity records, or empty array if none found.
 */
function extractRecords(responseData) {
  if (!responseData) {
    return [];
  }

  const directCandidates = [
    responseData,
    responseData.data,
    responseData.items,
    responseData.data && responseData.data.items
  ];

  for (let i = 0; i < directCandidates.length; i += 1) {
    const normalized = normalizeRecordArray(directCandidates[i]);
    if (normalized.length > 0) {
      return normalized;
    }
  }

  if (responseData.data) {
    const nestedDataRecords = extractArrayFromUnknown(responseData.data);
    if (nestedDataRecords.length > 0) {
      return nestedDataRecords;
    }
  }

  const nestedRecords = extractArrayFromUnknown(responseData);
  if (nestedRecords.length > 0) {
    return nestedRecords;
  }

  return [];
}

/**
 * @description Recursively attempts to extract an array from an unknown data structure.
 * @param {*} value - A value that may contain records in items, nodes, edges, or nested keys.
 * @returns {Array<Object>} An array of records, or empty array if none found.
 */
function extractArrayFromUnknown(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return normalizeRecordArray(value);
  }

  if (typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value.items)) {
    const items = normalizeRecordArray(value.items);
    if (items.length > 0) {
      return items;
    }
  }

  if (Array.isArray(value.nodes)) {
    const nodes = normalizeRecordArray(value.nodes);
    if (nodes.length > 0) {
      return nodes;
    }
  }

  if (Array.isArray(value.edges)) {
    const nodes = normalizeRecordArray(
      value.edges.map((edge) => (edge && edge.node ? edge.node : null))
    );
    if (nodes.length > 0) {
      return nodes;
    }
  }

  if (value.id && (typeof value.id === "string" || typeof value.id === "number")) {
    return [value];
  }

  const keys = Object.keys(value);
  for (let i = 0; i < keys.length; i += 1) {
    const nested = extractArrayFromUnknown(value[keys[i]]);
    if (nested.length > 0) {
      return nested;
    }
  }

  return [];
}

/**
 * @description Returns only object-like records from an unknown array value.
 *
 * Drops primitive arrays (for example metadata lists) to avoid treating them
 * as entity records in downstream matching logic.
 *
 * @param {*} value - A value that may be an array of records.
 * @returns {Array<Object>} A filtered array containing object entries only.
 */
function normalizeRecordArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      (typeof entry.id === "string" || typeof entry.id === "number")
  );
}

/**
 * @description Safely parses a JSON string, returning null on failure.
 * @param {string} rawValue - The raw JSON string to parse.
 * @returns {*} The parsed value, or null if parsing fails.
 */
function tryParseJson(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    return null;
  }
}

/**
 * @description Returns a standard empty success result for queries with no matching records.
 * @returns {Object} An API response with ok: true, statusCode: 200, and empty data array.
 */
function emptySuccessResult() {
  return {
    ok: true,
    statusCode: 200,
    data: []
  };
}

/**
 * @description Normalizes an email value to lowercase trimmed form.
 * @param {string} value - An email address string.
 * @returns {string} The normalized email.
 */
function normalizeEmailValue(value) {
  return normalizeString(value).toLowerCase();
}

/**
 * @description Collects all email addresses from a person record's various field formats.
 *
 * Handles emails as a string, array, or object with nested entries to
 * accommodate different Twenty API response shapes.
 *
 * @param {Object} person - A Twenty CRM person record.
 * @returns {Array<string>} A deduplicated array of email address strings.
 */
function collectPersonEmails(person) {
  const candidates = [];

  pushStringCandidate(candidates, person.email);
  pushStringCandidate(candidates, person.primaryEmail);

  const emails = person.emails;
  if (!emails) {
    return dedupeStrings(candidates);
  }

  if (typeof emails === "string") {
    pushStringCandidate(candidates, emails);
    return dedupeStrings(candidates);
  }

  if (Array.isArray(emails)) {
    emails.forEach((entry) => {
      if (typeof entry === "string") {
        pushStringCandidate(candidates, entry);
        return;
      }
      if (!entry || typeof entry !== "object") {
        return;
      }
      pushStringCandidate(candidates, entry.email);
      pushStringCandidate(candidates, entry.address);
      pushStringCandidate(candidates, entry.value);
      pushStringCandidate(candidates, entry.primaryEmail);
    });
    return dedupeStrings(candidates);
  }

  if (typeof emails === "object") {
    Object.keys(emails).forEach((key) => {
      const entry = emails[key];
      if (typeof entry === "string") {
        pushStringCandidate(candidates, entry);
        return;
      }
      if (Array.isArray(entry)) {
        entry.forEach((item) => {
          if (typeof item === "string") {
            pushStringCandidate(candidates, item);
            return;
          }
          if (!item || typeof item !== "object") {
            return;
          }
          pushStringCandidate(candidates, item.email);
          pushStringCandidate(candidates, item.address);
          pushStringCandidate(candidates, item.value);
        });
        return;
      }
      if (!entry || typeof entry !== "object") {
        return;
      }
      pushStringCandidate(candidates, entry.email);
      pushStringCandidate(candidates, entry.address);
      pushStringCandidate(candidates, entry.value);
    });
  }

  return dedupeStrings(candidates);
}

/**
 * @description Checks whether a company matches a free-text search query by name or domain.
 * @param {Object} company - A Twenty CRM company record.
 * @param {string} normalizedQuery - The lowercase search query.
 * @returns {boolean} True if the company name or any domain candidate contains the query.
 */
function companyMatchesQuery(company, normalizedQuery) {
  if (!company || !normalizedQuery) {
    return false;
  }

  const companyName = normalizeString(company.name).toLowerCase();
  if (companyName.indexOf(normalizedQuery) !== -1) {
    return true;
  }

  return collectCompanyDomainCandidates(company).some((candidate) => {
    const normalizedCandidate = normalizeString(candidate).toLowerCase();
    if (normalizedCandidate.indexOf(normalizedQuery) !== -1) {
      return true;
    }
    const normalizedDomain = normalizeDomainValue(candidate);
    return normalizedDomain && normalizedDomain.indexOf(normalizedQuery) !== -1;
  });
}

/**
 * @description Collects all domain-like strings from a company record's various field formats.
 * @param {Object} company - A Twenty CRM company record.
 * @returns {Array<string>} A deduplicated array of domain candidate strings.
 */
function collectCompanyDomainCandidates(company) {
  const candidates = [];

  pushStringCandidate(candidates, company.domainName);
  pushStringCandidate(candidates, company.websiteUrl);
  pushStringCandidate(candidates, company.primaryLinkUrl);

  if (company.domainName && typeof company.domainName === "object") {
    pushStringCandidate(candidates, company.domainName.primaryLinkUrl);
    pushStringCandidate(candidates, company.domainName.primaryDomain);
    pushStringCandidate(candidates, company.domainName.value);
  }

  if (Array.isArray(company.websites)) {
    company.websites.forEach((website) => {
      if (typeof website === "string") {
        pushStringCandidate(candidates, website);
        return;
      }
      if (!website || typeof website !== "object") {
        return;
      }
      pushStringCandidate(candidates, website.url);
      pushStringCandidate(candidates, website.value);
      pushStringCandidate(candidates, website.primaryLinkUrl);
    });
  }

  return dedupeStrings(candidates);
}

/**
 * @description Normalizes a domain value by stripping protocol, mailto, email prefix, www, path, and port.
 * @param {string} value - A raw domain, URL, or email-like string.
 * @returns {string} The normalized bare domain, or empty string if blank.
 */
function normalizeDomainValue(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "";
  }

  let cleaned = normalized.replace(/^mailto:/, "");
  if (cleaned.indexOf("@") !== -1) {
    cleaned = cleaned.split("@").pop();
  }
  cleaned = cleaned.replace(/^https?:\/\//, "");
  cleaned = cleaned.replace(/^www\./, "");
  cleaned = cleaned.split("/")[0];
  cleaned = cleaned.split("?")[0];
  cleaned = cleaned.split("#")[0];
  cleaned = cleaned.split(":")[0];

  return cleaned;
}

/**
 * @description Pushes a non-empty string value to a candidate array.
 * @param {Array<string>} target - The array to push to.
 * @param {*} value - The value to push if it is a non-empty string.
 */
function pushStringCandidate(target, value) {
  if (!isNonEmptyString(value)) {
    return;
  }
  target.push(String(value));
}

/**
 * @description Deduplicates an array of strings by their lowercase normalized form.
 * @param {Array<string>} values - The string values to deduplicate.
 * @returns {Array<string>} Values with duplicates removed, preserving first occurrence.
 */
function dedupeStrings(values) {
  const seen = {};
  const result = [];

  values.forEach((value) => {
    const key = normalizeString(value).toLowerCase();
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    result.push(value);
  });

  return result;
}

/**
 * @description Deduplicates an array of objects by their id field.
 * @param {Array<Object>} items - Objects with id properties.
 * @returns {Array<Object>} Items with duplicates removed, preserving first occurrence.
 */
function dedupeById(items) {
  const seen = {};
  const result = [];

  items.forEach((item) => {
    const key = normalizeString(item && item.id ? String(item.id) : "");
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    result.push(item);
  });

  return result;
}

/**
 * @description Splits a full name string into firstName and lastName components.
 * @param {string} fullName - The full name to split.
 * @returns {Object} An object with firstName and lastName string properties.
 */
function splitName(fullName) {
  const normalized = normalizeString(fullName);
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "" };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" ")
  };
}

/**
 * @description Ensures a domain string has an https:// protocol prefix.
 * @param {string} domainOrUrl - A domain or URL string.
 * @returns {string} The value with https:// prepended if no protocol was present.
 */
function toUrl(domainOrUrl) {
  const value = normalizeString(domainOrUrl);
  if (!value) {
    return "";
  }

  if (value.indexOf("http://") === 0 || value.indexOf("https://") === 0) {
    return value;
  }

  return "https://" + value;
}

/**
 * @description Builds a target payload for noteTarget or taskTarget creation.
 * @param {string} targetType - One of ENTITY_TYPES values.
 * @param {string} targetId - The target entity's ID.
 * @returns {Object|null} A payload with the appropriate target field, or null if invalid.
 */
function buildTargetPayload(targetType, targetId) {
  if (!targetType || !targetId) {
    return null;
  }

  if (targetType === ENTITY_TYPES.PERSON) {
    return { targetPersonId: targetId };
  }
  if (targetType === ENTITY_TYPES.COMPANY) {
    return { targetCompanyId: targetId };
  }
  if (targetType === ENTITY_TYPES.OPPORTUNITY) {
    return { targetOpportunityId: targetId };
  }

  return null;
}

/**
 * @description Parses a "type:id" related target reference string.
 * @param {string} value - A colon-separated string like "person:abc123".
 * @returns {Object} An object with type and id string properties.
 */
function parseRelatedTarget(value) {
  const parts = String(value || "").split(":");
  return {
    type: parts[0] || "",
    id: parts[1] || ""
  };
}

/**
 * @description Extracts the created entity ID from a Twenty API create response.
 *
 * Checks multiple response shapes: direct id, data.id, data[operationName].id,
 * and nested object keys with an id field.
 *
 * @param {*} responseData - The parsed response body from a create operation.
 * @param {string} operationName - The expected mutation key (e.g. "createNote").
 * @returns {string} The entity ID, or empty string if not found.
 */
function extractCreatedEntityId(responseData, operationName) {
  if (!responseData) {
    return "";
  }

  if (responseData.id) {
    return String(responseData.id);
  }

  if (responseData.data && responseData.data.id) {
    return String(responseData.data.id);
  }

  if (
    responseData.data &&
    responseData.data[operationName] &&
    responseData.data[operationName].id
  ) {
    return String(responseData.data[operationName].id);
  }

  if (responseData.data && typeof responseData.data === "object") {
    const keys = Object.keys(responseData.data);
    for (let i = 0; i < keys.length; i += 1) {
      const candidate = responseData.data[keys[i]];
      if (candidate && typeof candidate === "object" && candidate.id) {
        return String(candidate.id);
      }
    }
  }

  return "";
}
