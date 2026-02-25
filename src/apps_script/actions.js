/**
 * @file actions.js - Gmail add-on CardService action handlers.
 *
 * Each exported function corresponds to an ACTION_NAMES entry and is invoked
 * by CardService when the user clicks a button in the sidebar. Handlers
 * validate input, call Twenty API operations, and return card navigation responses.
 */

/**
 * @description Handles the "Save token" button click on the add-on root card.
 * @param {Object} e - The Gmail add-on event object containing form input.
 * @returns {Object} A CardService ActionResponse that updates the root card.
 */
function onSaveApiToken(e) {
  const context = extractMessageContext(e);
  const apiToken = getFormValue(e, FORM_FIELDS.API_TOKEN);
  const inputCheck = validateApiTokenInput(apiToken);

  if (!inputCheck.ok) {
    return buildUpdateCardActionResponse(
      buildAddonMainCardForEvent(e, { tokenError: inputCheck.message })
    );
  }

  const tokenCheck = validateApiToken(apiToken);
  if (!tokenCheck.ok) {
    return buildUpdateCardActionResponse(
      buildAddonMainCardForEvent(e, { tokenError: tokenCheck.message })
    );
  }

  saveUserApiToken(apiToken);
  if (isValidEmail(context.fromEmail)) {
    return buildUpdateCardActionResponse(buildHomeCardForEvent(e, { forceRefresh: true }));
  }
  return buildUpdateCardActionResponse(
    buildAddonMainCardForEvent(e, { tokenNotice: "Token saved successfully." })
  );
}

/**
 * @description Opens the current message context from the add-on root card.
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Object} A CardService ActionResponse: notification on error, update card for API errors, or push card on success.
 */
function onOpenMessageContext(e) {
  const context = extractMessageContext(e);
  if (!isValidEmail(context.fromEmail)) {
    return buildNotificationActionResponse(
      "Open an email conversation to load contextual CRM actions."
    );
  }

  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAddonMainCardForEvent(e, {
        tokenError: "A Twenty API token is required before opening email context."
      })
    );
  }

  const tokenCheck = validateApiToken(apiToken);
  if (!tokenCheck.ok) {
    if (tokenCheck.shouldClearToken) {
      clearUserApiToken();
      return buildUpdateCardActionResponse(
        buildAddonMainCardForEvent(e, { tokenError: tokenCheck.message })
      );
    }

    if (tokenCheck.reason === "rate_limited") {
      return buildPushCardActionResponse(buildRateLimitedCard(context, tokenCheck.message));
    }

    return buildPushCardActionResponse(buildApiErrorCard(context, tokenCheck.message));
  }

  const contextCard = buildSidebarMainCard(loadSidebarState(context, apiToken, false));
  return buildPushCardActionResponse(contextCard);
}

/**
 * @description Handles the "Refresh" button click to reload sender context.
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Object} A CardService ActionResponse with the refreshed sidebar card.
 */
function onRefreshContext(e) {
  const refreshedCard = buildHomeCardForEvent(e, { forceRefresh: true });
  return buildUpdateCardActionResponse(refreshedCard);
}

/**
 * @description Handles the "Reset token" button click to clear stored credentials.
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Object} A CardService ActionResponse that returns to the add-on root card.
 */
function onResetApiToken(e) {
  const context = extractMessageContext(e);
  clearUserApiToken();
  if (isValidEmail(context.fromEmail)) {
    return buildUpdateCardActionResponse(buildHomeCardForEvent(e, { forceRefresh: true }));
  }
  return buildUpdateCardActionResponse(
    buildAddonMainCardForEvent(e, { tokenNotice: "Token removed." })
  );
}

/**
 * @description Opens the quick-create entity form as a pushed card.
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Object} A CardService ActionResponse that pushes the quick-create card.
 */
function onOpenQuickCreateForm(e) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAuthRequiredCard(context, "You must authenticate before creating entities.")
    );
  }

  const state = loadSidebarState(context, apiToken, false);
  const quickCreateCard = buildQuickCreateCard(context, state.targets || []);
  return buildPushCardActionResponse(quickCreateCard);
}

/**
 * @description Re-renders the quick-create form when the entity type changes.
 *
 * Preserves in-progress form values while updating the visible fields for the
 * selected entity type.
 *
 * @param {Object} e - The Gmail add-on event object with form values.
 * @returns {Object} A CardService ActionResponse with the updated form card.
 */
function onUpdateQuickCreateForm(e) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAuthRequiredCard(context, "You must authenticate before creating entities.")
    );
  }

  const mode = getQuickCreateMode(e);
  const formValues = collectQuickCreateFormValues(e);
  const state = loadSidebarState(context, apiToken, false);
  const quickCreateOptions = {
    initialValues: formValues
  };

  if (mode === QUICK_CREATE_MODE.INLINE) {
    if (state.targets && state.targets.length > 0) {
      return buildUpdateCardActionResponse(buildSidebarMainCard(state));
    }
    return buildUpdateCardActionResponse(
      buildSidebarMainCard(state, { quickCreateOptions: quickCreateOptions })
    );
  }

  const quickCreateCard = buildQuickCreateCard(context, state.targets || [], quickCreateOptions);
  return buildUpdateCardActionResponse(quickCreateCard);
}

/**
 * @description Handles company search within the quick-create form.
 *
 * Queries the Twenty API for companies matching the user's search text and
 * re-renders the quick-create form with the results.
 *
 * @param {Object} e - The Gmail add-on event object with search query in form input.
 * @returns {Object} A CardService ActionResponse with updated company search results.
 */
function onSearchCompany(e) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAuthRequiredCard(context, "You must authenticate before creating entities.")
    );
  }

  const mode = getQuickCreateMode(e);
  const formValues = collectQuickCreateFormValues(e);
  const state = loadSidebarState(context, apiToken, false);

  let companySearchMessage = "";
  let companySearchError = "";
  let companyOptions = [];

  if (
    !isNonEmptyString(formValues.companySearchQuery) ||
    formValues.companySearchQuery.length < 3
  ) {
    companySearchMessage = "Type at least 3 characters to search companies.";
  } else {
    const searchResponse = searchCompaniesByQuery(formValues.companySearchQuery, apiToken);
    if (searchResponse.statusCode === 429) {
      companySearchError = "Twenty API rate limit reached while searching companies.";
    } else if (!searchResponse.ok) {
      companySearchError = "Unable to search companies right now.";
    } else {
      const companies = extractRecords(searchResponse.data);
      companyOptions = companies.map(actionBuildCompanyOption);
      companySearchMessage =
        companies.length > 0
          ? companies.length + " companies found."
          : "No companies found for that query.";
    }
  }

  const quickCreateOptions = {
    initialValues: formValues,
    personCompanyOptions: companyOptions,
    companySearchMessage: companySearchMessage,
    companySearchError: companySearchError
  };

  if (mode === QUICK_CREATE_MODE.INLINE) {
    if (state.targets && state.targets.length > 0) {
      return buildUpdateCardActionResponse(buildSidebarMainCard(state));
    }
    return buildUpdateCardActionResponse(
      buildSidebarMainCard(state, { quickCreateOptions: quickCreateOptions })
    );
  }

  const quickCreateCard = buildQuickCreateCard(context, state.targets || [], quickCreateOptions);
  return buildUpdateCardActionResponse(quickCreateCard);
}

/**
 * @description Handles the "Create entity" button click for quick entity creation.
 *
 * Determines entity type from form input (or forces Person in inline mode),
 * validates the payload, creates the entity via the Twenty API, and optionally
 * auto-creates or matches a company for inline person creation.
 *
 * @param {Object} e - The Gmail add-on event object with entity creation form data.
 * @returns {Object} A CardService ActionResponse — either a refreshed card or a notification.
 */
function onCreateQuickEntity(e) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAuthRequiredCard(context, "You must authenticate before creating entities.")
    );
  }

  const mode = getQuickCreateMode(e);
  const requestedEntityType = getFormValue(e, FORM_FIELDS.QUICK_ENTITY_TYPE);
  const entityType = mode === QUICK_CREATE_MODE.INLINE ? ENTITY_TYPES.PERSON : requestedEntityType;
  const quickRelatedRef = getFormValue(e, FORM_FIELDS.QUICK_RELATED_ID);
  const quickRelated = parseSelectedTarget(quickRelatedRef);
  const selectedPersonCompanyId = getFormValue(e, FORM_FIELDS.QUICK_PERSON_COMPANY_ID);
  const payload = {
    name: getFormValue(e, FORM_FIELDS.QUICK_NAME),
    email: getFormValue(e, FORM_FIELDS.QUICK_EMAIL),
    companyName: getFormValue(e, FORM_FIELDS.QUICK_COMPANY_NAME),
    domain: getFormValue(e, FORM_FIELDS.QUICK_DOMAIN),
    relatedRecordRef: quickRelatedRef,
    companyId:
      selectedPersonCompanyId || (quickRelated.type === ENTITY_TYPES.COMPANY ? quickRelated.id : "")
  };

  const validation = validateQuickEntityInput(entityType, payload);
  if (!validation.ok) {
    return buildNotificationActionResponse(validation.message);
  }

  let response;
  if (entityType === ENTITY_TYPES.PERSON) {
    if (mode === QUICK_CREATE_MODE.INLINE) {
      const companyResolution = resolveCompanyForInlinePersonCreation(payload, apiToken);
      if (!companyResolution.ok) {
        return buildNotificationActionResponse(
          companyResolution.message || "Unable to resolve company."
        );
      }
      payload.companyId = companyResolution.companyId || payload.companyId || "";
      if (companyResolution.createdCompany) {
        rememberRecentCompany(actionToRecentCompany(companyResolution.createdCompany));
      }
      if (companyResolution.matchedCompany) {
        rememberRecentCompany(actionToRecentCompany(companyResolution.matchedCompany));
      }
    }
    response = createQuickPerson(payload, apiToken);
  } else if (entityType === ENTITY_TYPES.COMPANY) {
    response = createQuickCompany(payload, apiToken);
  } else {
    response = createQuickOpportunity(payload, apiToken);
  }

  if (!response.ok) {
    return buildNotificationActionResponse(
      "Unable to create entity. Please verify fields and retry."
    );
  }

  if (entityType === ENTITY_TYPES.PERSON && payload.companyId) {
    rememberRecentCompanyById(payload.companyId, apiToken);
  }

  if (entityType === ENTITY_TYPES.COMPANY) {
    const createdCompanies = extractRecords(response.data);
    if (createdCompanies.length > 0) {
      rememberRecentCompany(actionToRecentCompany(createdCompanies[0]));
    }
  }

  const refreshedCard = buildHomeCardForEvent(e, { forceRefresh: true });
  return buildUpdateCardActionResponse(refreshedCard);
}

/**
 * @description Handles the "Create note" button click.
 * @param {Object} e - The Gmail add-on event object with note form data.
 * @returns {Object} A CardService ActionResponse with a success or error notification.
 */
function onCreateNote(e) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAuthRequiredCard(context, "Authentication is required.")
    );
  }

  const selectedTarget = getFormValue(e, FORM_FIELDS.TARGET_ENTITY);
  const noteBody = getFormValue(e, FORM_FIELDS.NOTE_BODY);
  const validation = validateNoteInput(noteBody, selectedTarget);
  if (!validation.ok) {
    return buildNotificationActionResponse(validation.message);
  }

  const parsed = parseSelectedTarget(selectedTarget);
  let response;
  try {
    response = createNote(
      {
        title: context.subject || "Gmail note",
        body: noteBody,
        targetType: parsed.type,
        targetId: parsed.id,
        messageId: context.messageId,
        threadId: context.threadId
      },
      apiToken
    );
  } catch (error) {
    logError("onCreateNote", error, { correlationId: context.correlationId });
    return buildNotificationActionResponse("Unable to create note right now.");
  }

  if (!response.ok) {
    return buildNotificationActionResponse("Unable to create note.");
  }

  return buildNotificationActionResponse("Note created successfully.");
}

/**
 * @description Handles the "Create activity" button click.
 * @param {Object} e - The Gmail add-on event object with activity form data.
 * @returns {Object} A CardService ActionResponse with a success or error notification.
 */
function onCreateActivity(e) {
  const context = extractMessageContext(e);
  const apiToken = getUserApiToken();
  if (!apiToken) {
    return buildUpdateCardActionResponse(
      buildAuthRequiredCard(context, "Authentication is required.")
    );
  }

  const selectedTarget = getFormValue(e, FORM_FIELDS.TARGET_ENTITY);
  const activityTitle = getFormValue(e, FORM_FIELDS.ACTIVITY_TITLE);
  const activityDueDate = getFormValue(e, FORM_FIELDS.ACTIVITY_DUE_DATE);
  const validation = validateActivityInput(activityTitle, selectedTarget, activityDueDate);
  if (!validation.ok) {
    return buildNotificationActionResponse(validation.message);
  }

  const parsed = parseSelectedTarget(selectedTarget);
  let response;
  try {
    response = createActivity(
      {
        title: activityTitle,
        dueDate: activityDueDate,
        body: context.subject ? "From email: " + context.subject : "",
        targetType: parsed.type,
        targetId: parsed.id
      },
      apiToken
    );
  } catch (error) {
    logError("onCreateActivity", error, { correlationId: context.correlationId });
    return buildNotificationActionResponse("Unable to create activity right now.");
  }

  if (!response.ok) {
    return buildNotificationActionResponse("Unable to create activity.");
  }

  return buildNotificationActionResponse("Activity created successfully.");
}

/**
 * @description Parses a "type:id" string into its type and id components.
 * @param {string} value - A colon-separated string like "person:abc123".
 * @returns {Object} An object with type and id string properties.
 */
function parseSelectedTarget(value) {
  const parts = String(value || "").split(":");
  return {
    type: parts[0] || "",
    id: parts[1] || ""
  };
}

/**
 * @description Determines whether the quick-create form is in inline or card mode.
 * @param {Object} e - The Gmail add-on event object.
 * @returns {string} Either QUICK_CREATE_MODE.INLINE or QUICK_CREATE_MODE.CARD.
 */
function getQuickCreateMode(e) {
  const rawMode =
    e && e.parameters && isNonEmptyString(e.parameters[UI_PARAM_KEYS.QUICK_CREATE_MODE])
      ? e.parameters[UI_PARAM_KEYS.QUICK_CREATE_MODE]
      : "";

  return rawMode === QUICK_CREATE_MODE.INLINE ? QUICK_CREATE_MODE.INLINE : QUICK_CREATE_MODE.CARD;
}

/**
 * @description Collects all quick-create form field values from the event object.
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Object} An object with entityType, name, email, companyName, domain,
 *   relatedRecordRef, personCompanyId, and companySearchQuery fields.
 */
function collectQuickCreateFormValues(e) {
  return {
    entityType: getFormValue(e, FORM_FIELDS.QUICK_ENTITY_TYPE),
    name: getFormValue(e, FORM_FIELDS.QUICK_NAME),
    email: getFormValue(e, FORM_FIELDS.QUICK_EMAIL),
    companyName: getFormValue(e, FORM_FIELDS.QUICK_COMPANY_NAME),
    domain: getFormValue(e, FORM_FIELDS.QUICK_DOMAIN),
    relatedRecordRef: getFormValue(e, FORM_FIELDS.QUICK_RELATED_ID),
    personCompanyId: getFormValue(e, FORM_FIELDS.QUICK_PERSON_COMPANY_ID),
    companySearchQuery: getFormValue(e, FORM_FIELDS.QUICK_COMPANY_SEARCH)
  };
}

/**
 * @description Resolves or creates a company for inline person creation.
 *
 * When creating a person in inline (no-match) mode, this function attempts to
 * find an existing company by domain, or creates one if none exists. Returns a
 * result object indicating success and the resolved company ID.
 *
 * @param {Object} payload - The entity creation payload with companyId, companyName, and domain.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 * @returns {Object} A result with ok, companyId, createdCompany, matchedCompany, and message fields.
 */
function resolveCompanyForInlinePersonCreation(payload, apiToken) {
  const explicitCompanyId = normalizeString(payload.companyId);
  if (explicitCompanyId) {
    return {
      ok: true,
      companyId: explicitCompanyId,
      createdCompany: null,
      matchedCompany: null
    };
  }

  const explicitCompanyName = normalizeString(payload.companyName);
  const explicitDomain = normalizeDomainInput(payload && payload.domain ? payload.domain : "");

  // User explicitly cleared both optional company fields: create person without company.
  if (!explicitCompanyName && !explicitDomain) {
    return {
      ok: true,
      companyId: "",
      createdCompany: null,
      matchedCompany: null
    };
  }

  if (explicitDomain) {
    const companyLookup = findCompanyByDomain(explicitDomain, apiToken);
    if (companyLookup.statusCode === 429) {
      return {
        ok: false,
        message: "Twenty API rate limit reached while resolving company."
      };
    }
    if (!companyLookup.ok) {
      return {
        ok: false,
        message: "Unable to check if a company already exists for this domain."
      };
    }

    const existingCompanies = extractRecords(companyLookup.data);
    if (existingCompanies.length === 1) {
      return {
        ok: true,
        companyId: String(existingCompanies[0].id || ""),
        createdCompany: null,
        matchedCompany: existingCompanies[0]
      };
    }

    if (existingCompanies.length > 1) {
      return {
        ok: false,
        message: "Multiple companies match this domain. Please select one in Person company."
      };
    }
  }

  const fallbackCompanyName = explicitCompanyName || deriveCompanyNameFromDomain(explicitDomain);
  if (!explicitDomain || !fallbackCompanyName) {
    return {
      ok: true,
      companyId: "",
      createdCompany: null,
      matchedCompany: null
    };
  }

  const createCompanyResponse = createQuickCompany(
    {
      name: fallbackCompanyName,
      domain: explicitDomain
    },
    apiToken
  );

  if (!createCompanyResponse.ok) {
    return {
      ok: false,
      message: "Unable to create company from provided domain."
    };
  }

  const createdCompanies = extractRecords(createCompanyResponse.data);
  const createdCompany =
    createdCompanies.length > 0
      ? createdCompanies[0]
      : {
          id: extractCreatedEntityId(createCompanyResponse.data, "createCompany"),
          name: fallbackCompanyName
        };

  return {
    ok: true,
    companyId: String(createdCompany && createdCompany.id ? createdCompany.id : ""),
    createdCompany: createdCompany,
    matchedCompany: null
  };
}

/**
 * @description Looks up a company by ID and adds it to the recent companies list.
 * @param {string} companyId - The company ID to look up and remember.
 * @param {string} apiToken - The authenticated user's Twenty API token.
 */
function rememberRecentCompanyById(companyId, apiToken) {
  if (!isNonEmptyString(companyId)) {
    return;
  }

  const response = findCompanyById(companyId, apiToken);
  if (!response.ok) {
    rememberRecentCompany({ id: companyId, name: "", domain: "" });
    return;
  }

  const companies = extractRecords(response.data);
  if (companies.length === 0) {
    rememberRecentCompany({ id: companyId, name: "", domain: "" });
    return;
  }

  rememberRecentCompany(actionToRecentCompany(companies[0]));
}

/**
 * @description Converts a Twenty CRM company record into a recent-company storage format.
 * @param {Object} company - A Twenty CRM company record.
 * @returns {Object} A normalized object with id, name, and domain string fields.
 */
function actionToRecentCompany(company) {
  return {
    id: String(company && company.id ? company.id : ""),
    name: normalizeString(company && company.name ? company.name : ""),
    domain: extractCompanyDomain(company)
  };
}

/**
 * @description Converts a Twenty CRM company record into a dropdown option for the UI.
 * @param {Object} company - A Twenty CRM company record.
 * @returns {Object} An option object with id and label string fields.
 */
function actionBuildCompanyOption(company) {
  const entry = actionToRecentCompany(company);
  return {
    id: entry.id,
    label: formatCompanyLabel(entry)
  };
}
