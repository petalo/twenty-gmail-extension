/**
 * @file main.js - Add-on entry point and sidebar state orchestration.
 *
 * Contains the Gmail contextual trigger handler, sidebar state loading with
 * caching, target resolution logic, and entity display name formatting.
 */

/**
 * @description Gmail add-on contextual trigger entry point.
 *
 * Called by Gmail when a message is opened. Returns an array containing
 * the sidebar card for the current message context.
 *
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Array<Object>} An array with a single CardService Card instance.
 */
function buildMessageHome(e) {
  return [buildHomeCardForEvent(e, { forceRefresh: false })];
}

/**
 * @description Gmail add-on homepage trigger entry point.
 *
 * Called when the user opens the add-on outside a specific message context.
 * Returns the same root card used by contextual entry.
 *
 * @param {Object} e - The add-on homepage event object.
 * @returns {Array<Object>} An array with a single CardService Card instance.
 */
function buildAddonHome(e) {
  return [buildAddonMainCardForEvent(e, {})];
}

/**
 * @description Builds the add-on root card with token/account controls.
 *
 * @param {Object} e - Gmail add-on event object.
 * @param {Object} options - Optional values with tokenError and tokenNotice.
 * @returns {Object} A CardService Card instance for the root card.
 */
function buildAddonMainCardForEvent(e, options) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  const viewOptions = options || {};
  return buildAddonMainCard(context, {
    hasToken: isNonEmptyString(apiToken),
    canOpenContext: isValidEmail(context.fromEmail),
    tokenError: viewOptions.tokenError || "",
    tokenNotice: viewOptions.tokenNotice || ""
  });
}

/**
 * @description Builds the appropriate sidebar card based on auth state and sender lookup.
 * @param {Object} e - The Gmail add-on event object.
 * @param {Object} options - Options with forceRefresh (boolean) to bypass cache.
 * @returns {Object} A CardService Card instance.
 */
function buildHomeCardForEvent(e, options) {
  const forceRefresh = Boolean(options && options.forceRefresh);
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();

  if (!apiToken) {
    return buildAuthRequiredCard(context, "");
  }

  const tokenValidation = validateApiToken(apiToken);
  if (!tokenValidation.ok) {
    if (tokenValidation.shouldClearToken) {
      clearUserApiToken();
      return buildAuthRequiredCard(context, tokenValidation.message);
    }

    if (tokenValidation.reason === "rate_limited") {
      return buildRateLimitedCard(context, tokenValidation.message);
    }

    return buildApiErrorCard(context, tokenValidation.message);
  }

  if (!isValidEmail(context.fromEmail)) {
    return buildApiErrorCard(context, "Unable to resolve sender email from this message.");
  }

  const sidebarState = loadSidebarState(context, apiToken, forceRefresh);
  return buildSidebarMainCard(sidebarState);
}

/**
 * @description Loads the full sidebar state by looking up person, company, and opportunities.
 *
 * Checks cache first (unless forceRefresh is true), then queries the Twenty API
 * for person by email, company by person association or domain fallback, and
 * related opportunities.
 *
 * @param {Object} context - The message context from extractMessageContext.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @param {boolean} forceRefresh - Whether to bypass the sidebar state cache.
 * @returns {Object} The sidebar state with status, targets, person, company, opportunities, and errors.
 */
function loadSidebarState(context, apiToken, forceRefresh) {
  const startedAt = Date.now();
  let ambiguousCompanyTargets = [];
  if (!forceRefresh) {
    const cachedState = loadCachedSidebarState(context);
    if (cachedState) {
      logInfo("loadSidebarState.cacheHit", {
        correlationId: context.correlationId,
        latencyMs: Date.now() - startedAt
      });
      return cachedState;
    }
  }

  const state = {
    status: forceRefresh ? SIDEBAR_STATUS.REFRESHING : SIDEBAR_STATUS.LOADING,
    messageContext: context,
    person: null,
    company: null,
    opportunities: [],
    targets: [],
    errors: []
  };

  try {
    const personResponse = findPersonByEmail(context.fromEmail, apiToken);
    if (personResponse.statusCode === 429) {
      return buildRateLimitedState(context, "Twenty API rate limit reached.");
    }
    if (!personResponse.ok) {
      return buildApiErrorState(context, "Unable to load person data.");
    }

    const people = extractRecords(personResponse.data);
    if (people.length > 0) {
      state.person = people[0];
    }

    const personCompanyId = getPersonCompanyId(state.person);
    if (personCompanyId) {
      const companyByIdResponse = findCompanyById(personCompanyId, apiToken);
      if (companyByIdResponse.ok) {
        const companiesById = extractRecords(companyByIdResponse.data);
        if (companiesById.length > 0) {
          state.company = companiesById[0];
        }
      }
    }

    if (
      !state.company &&
      !state.person &&
      context.domain &&
      !isGenericEmailDomain(context.domain)
    ) {
      const companyResponse = findCompanyByDomain(context.domain, apiToken);
      if (companyResponse.statusCode === 429) {
        return buildRateLimitedState(context, "Twenty API rate limit reached.");
      }
      if (!companyResponse.ok) {
        return buildApiErrorState(context, "Unable to load company data.");
      }

      const companies = extractRecords(companyResponse.data);
      if (companies.length === 1) {
        state.company = companies[0];
      } else if (companies.length > 1) {
        ambiguousCompanyTargets = companies.map((company) =>
          mapEntityToTarget(company, ENTITY_TYPES.COMPANY, "domain_fallback")
        );
      }
    }

    const opportunities = loadOpportunitiesForState(state, apiToken);
    state.opportunities = opportunities;

    const targets = buildAvailableTargets(state).concat(ambiguousCompanyTargets);
    state.targets = deduplicateTargets(targets);
    if (state.targets.length === 0) {
      state.status = SIDEBAR_STATUS.NO_MATCH;
    } else if (ambiguousCompanyTargets.length > 0) {
      state.status = SIDEBAR_STATUS.AMBIGUOUS_MATCH;
    } else {
      state.status = SIDEBAR_STATUS.MATCHED;
    }
    cacheSidebarState(context, state);
    logInfo("loadSidebarState.summary", {
      correlationId: context.correlationId,
      status: state.status,
      targetCount: state.targets.length,
      opportunityCount: state.opportunities.length,
      latencyMs: Date.now() - startedAt
    });
    return state;
  } catch (error) {
    logError("loadSidebarState", error, {
      correlationId: context.correlationId,
      latencyMs: Date.now() - startedAt
    });
    return buildApiErrorState(context, "Unexpected error while loading data.");
  }
}

/**
 * @description Loads opportunities linked to the person and/or company in the sidebar state.
 * @param {Object} state - The current sidebar state with person and company fields.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Array<Object>} A deduplicated array of opportunity records.
 */
function loadOpportunitiesForState(state, apiToken) {
  const allOpportunities = [];

  if (state.person && state.person.id) {
    const personOpportunitiesResponse = listOpportunitiesByTarget(
      ENTITY_TYPES.PERSON,
      state.person.id,
      apiToken
    );
    if (personOpportunitiesResponse.ok) {
      allOpportunities.push.apply(
        allOpportunities,
        extractRecords(personOpportunitiesResponse.data)
      );
    }
  }

  if (state.company && state.company.id) {
    const companyOpportunitiesResponse = listOpportunitiesByTarget(
      ENTITY_TYPES.COMPANY,
      state.company.id,
      apiToken
    );
    if (companyOpportunitiesResponse.ok) {
      allOpportunities.push.apply(
        allOpportunities,
        extractRecords(companyOpportunitiesResponse.data)
      );
    }
  }

  return dedupeEntitiesById(allOpportunities);
}

/**
 * @description Assembles the list of selectable target entities from the sidebar state.
 * @param {Object} state - The sidebar state with person, company, and opportunities.
 * @returns {Array<Object>} Deduplicated target objects with type, id, label, and source.
 */
function buildAvailableTargets(state) {
  const targets = [];

  if (state.person) {
    targets.push(mapEntityToTarget(state.person, ENTITY_TYPES.PERSON, "exact_email"));
  }

  if (state.company) {
    targets.push(mapEntityToTarget(state.company, ENTITY_TYPES.COMPANY, "domain_fallback"));
  }

  state.opportunities.forEach((opportunity) => {
    targets.push(mapEntityToTarget(opportunity, ENTITY_TYPES.OPPORTUNITY, "related_record"));
  });

  return deduplicateTargets(targets);
}

/**
 * @description Maps a Twenty CRM entity to a sidebar target descriptor.
 * @param {Object} entity - A Twenty CRM record (person, company, or opportunity).
 * @param {string} entityType - One of ENTITY_TYPES values.
 * @param {string} source - How the entity was resolved (e.g. "exact_email", "domain_fallback").
 * @returns {Object} A target object with type, id, label, and source properties.
 */
function mapEntityToTarget(entity, entityType, source) {
  const label = getEntityDisplayName(entity, entityType);
  return {
    type: entityType,
    id: String(entity.id || ""),
    label: label,
    source: source
  };
}

/**
 * @description Removes duplicate targets based on their type:id composite key.
 * @param {Array<Object>} targets - An array of target objects.
 * @returns {Array<Object>} Targets with duplicates removed, preserving first occurrence.
 */
function deduplicateTargets(targets) {
  const seen = {};
  const result = [];

  targets.forEach((target) => {
    if (!target.id || !target.type) {
      return;
    }
    const key = target.type + ":" + target.id;
    if (seen[key]) {
      return;
    }
    seen[key] = true;
    result.push(target);
  });

  return result;
}

/**
 * @description Deduplicates an array of entity objects by their id field.
 * @param {Array<Object>} items - Entity objects with id properties.
 * @returns {Array<Object>} Items with duplicates removed, preserving first occurrence.
 */
function dedupeEntitiesById(items) {
  const seen = {};
  const result = [];

  items.forEach((item) => {
    const key = String(item && item.id ? item.id : "");
    if (!key || seen[key]) {
      return;
    }
    seen[key] = true;
    result.push(item);
  });

  return result;
}

/**
 * @description Creates a sidebar state representing an API error.
 * @param {Object} context - The message context.
 * @param {string} message - The error message to display.
 * @returns {Object} A sidebar state object with API_ERROR status.
 */
function buildApiErrorState(context, message) {
  return {
    status: SIDEBAR_STATUS.API_ERROR,
    messageContext: context,
    person: null,
    company: null,
    opportunities: [],
    targets: [],
    errors: [{ code: "API_ERROR", message: message }]
  };
}

/**
 * @description Creates a sidebar state representing a rate-limit error.
 * @param {Object} context - The message context.
 * @param {string} message - The error message to display.
 * @returns {Object} A sidebar state object with RATE_LIMITED status.
 */
function buildRateLimitedState(context, message) {
  return {
    status: SIDEBAR_STATUS.RATE_LIMITED,
    messageContext: context,
    person: null,
    company: null,
    opportunities: [],
    targets: [],
    errors: [{ code: "RATE_LIMITED", message: message }]
  };
}

/**
 * @description Returns a human-readable display name for a Twenty CRM entity.
 * @param {Object} entity - A Twenty CRM record.
 * @param {string} entityType - One of ENTITY_TYPES values.
 * @returns {string} The entity's display name, falling back to type + id if unnamed.
 */
function getEntityDisplayName(entity, entityType) {
  if (!entity) {
    return entityType + " unknown";
  }

  if (entityType === ENTITY_TYPES.PERSON) {
    const firstName = entity.name && entity.name.firstName ? entity.name.firstName : "";
    const lastName = entity.name && entity.name.lastName ? entity.name.lastName : "";
    const fullName = normalizeString((firstName + " " + lastName).trim());
    const email = entity.emails && entity.emails.primaryEmail ? entity.emails.primaryEmail : "";
    return fullName || email || "Person " + (entity.id || "");
  }

  if (entityType === ENTITY_TYPES.COMPANY) {
    return entity.name || "Company " + (entity.id || "");
  }

  if (entityType === ENTITY_TYPES.OPPORTUNITY) {
    return entity.name || "Opportunity " + (entity.id || "");
  }

  return entity.name || entity.title || "Record " + (entity.id || "");
}

/**
 * @description Extracts the company ID associated with a person record.
 *
 * Checks companyId, company.id, and companies[0].id in priority order to
 * handle different Twenty API response shapes.
 *
 * @param {Object} person - A Twenty CRM person record.
 * @returns {string} The associated company ID, or empty string if none found.
 */
function getPersonCompanyId(person) {
  if (!person) {
    return "";
  }

  if (isNonEmptyString(person.companyId)) {
    return person.companyId;
  }

  if (person.company && isNonEmptyString(person.company.id)) {
    return person.company.id;
  }

  if (Array.isArray(person.companies) && person.companies.length > 0) {
    const firstCompany = person.companies[0];
    if (firstCompany && isNonEmptyString(firstCompany.id)) {
      return firstCompany.id;
    }
  }

  return "";
}

/**
 * @description Builds a deterministic cache key from the message context for sidebar state caching.
 * @param {Object} context - The message context.
 * @returns {string} A cache key like "sidebar:{messageId|threadId}:{email}", or empty string if insufficient data.
 */
function buildSidebarCacheKey(context) {
  const messageId = normalizeString(context && context.messageId ? context.messageId : "");
  const fromEmail = normalizeString(
    context && context.fromEmail ? context.fromEmail : ""
  ).toLowerCase();
  const threadId = normalizeString(context && context.threadId ? context.threadId : "");
  const base = messageId || threadId;
  if (!base || !fromEmail) {
    return "";
  }

  return "sidebar:" + base + ":" + fromEmail;
}

/**
 * @description Attempts to load a cached sidebar state from the Apps Script CacheService.
 * @param {Object} context - The message context used to derive the cache key.
 * @returns {Object|null} The cached sidebar state, or null if not found or expired.
 */
function loadCachedSidebarState(context) {
  const cacheKey = buildSidebarCacheKey(context);
  if (!cacheKey) {
    return null;
  }

  const cache = CacheService.getUserCache();
  const raw = cache.get(cacheKey);
  if (!isNonEmptyString(raw)) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
    return parsed;
  } catch (error) {
    logError("loadCachedSidebarState", error, { correlationId: "cache-read" });
    return null;
  }
}

/**
 * @description Stores the sidebar state in Apps Script CacheService for short-term reuse.
 * @param {Object} context - The message context used to derive the cache key.
 * @param {Object} state - The sidebar state to cache.
 */
function cacheSidebarState(context, state) {
  const cacheKey = buildSidebarCacheKey(context);
  if (!cacheKey || !state || typeof state !== "object") {
    return;
  }

  try {
    CacheService.getUserCache().put(
      cacheKey,
      JSON.stringify(state),
      SIDEBAR_STATE_CACHE_TTL_SECONDS
    );
  } catch (error) {
    logError("cacheSidebarState", error, { correlationId: "cache-write" });
  }
}
