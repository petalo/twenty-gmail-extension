/**
 * @file ui.js - CardService UI builders for the Gmail add-on sidebar.
 *
 * Contains all card and widget construction functions that render the sidebar
 * states: auth required, main view, quick create form, error cards, and
 * navigation response helpers.
 */

/**
 * @description Builds the root add-on card that acts as the navigation entry point.
 *
 * The root card is designed to be stable regardless of message context. It shows
 * a short product description, repository link, optional "open message context"
 * action, and account controls (save/reset token).
 *
 * @param {Object} context - Message context extracted from the event.
 * @param {Object} options - Display options with hasToken, canOpenContext, tokenError, tokenNotice.
 * @returns {Object} A CardService Card instance for the add-on root card.
 */
function buildAddonMainCard(context, options) {
  const viewOptions = options || {};
  const hasToken = Boolean(viewOptions.hasToken);
  const canOpenContext = Boolean(viewOptions.canOpenContext);
  const tokenError = normalizeString(viewOptions.tokenError);
  const tokenNotice = normalizeString(viewOptions.tokenNotice);
  const introSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(
        "<b>Twenty for Gmail</b><br><i>Work with Twenty CRM records directly from your Gmail sidebar.</i>"
      )
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Repository")
        .setOpenLink(CardService.newOpenLink().setUrl(EXTENSION_REPOSITORY_URL))
    );

  if (canOpenContext) {
    introSection.addWidget(
      CardService.newTextButton()
        .setText("Open current email context")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.OPEN_MESSAGE_CONTEXT)
            .setParameters(serializeContextParams(context))
        )
    );
  } else {
    introSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' +
          UI_COLORS.MUTED +
          '">Open an email conversation to load contextual CRM actions.</font>'
      )
    );
  }

  const accountSection = CardService.newCardSection().addWidget(
    CardService.newTextParagraph().setText("<b>Account</b>")
  );

  if (hasToken) {
    accountSection.addWidget(
      CardService.newTextParagraph().setText("Twenty API token is configured for this user.")
    );
    accountSection.addWidget(
      CardService.newTextButton()
        .setText("Reset token")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.RESET_TOKEN)
            .setParameters(serializeContextParams(context))
        )
    );
  } else {
    accountSection
      .addWidget(
        CardService.newTextInput()
          .setFieldName(FORM_FIELDS.API_TOKEN)
          .setTitle("Twenty API token")
          .setHint("Paste your personal API token")
      )
      .addWidget(
        CardService.newTextButton()
          .setText("Save token")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName(ACTION_NAMES.SAVE_API_TOKEN)
              .setParameters(serializeContextParams(context))
          )
      );
  }

  if (isNonEmptyString(tokenNotice)) {
    accountSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' + UI_COLORS.SUCCESS + '">' + tokenNotice + "</font>"
      )
    );
  }

  if (isNonEmptyString(tokenError)) {
    accountSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' + UI_COLORS.ERROR + '">' + tokenError + "</font>"
      )
    );
  }

  addAppUrlWidgets(accountSection, context);

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Twenty for Gmail"))
    .addSection(introSection)
    .addSection(accountSection)
    .build();
}

/**
 * @description Builds the authentication card shown when no valid API token is stored.
 *
 * Renders a token input field and save button, with an optional error message
 * displayed in red when a previous token validation failed.
 *
 * @param {Object} context - The message context from extractMessageContext.
 * @param {string} errorMessage - An optional error message to display below the input.
 * @returns {Object} A CardService Card instance for the auth prompt.
 */
function buildAuthRequiredCard(context, errorMessage) {
  const section = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("Connect your Twenty API token to continue."))
    .addWidget(
      CardService.newTextInput()
        .setFieldName(FORM_FIELDS.API_TOKEN)
        .setTitle("Twenty API token")
        .setHint("Paste your personal API token")
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Save token")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.SAVE_API_TOKEN)
            .setParameters(serializeContextParams(context))
        )
    );

  if (isNonEmptyString(errorMessage)) {
    section.addWidget(
      CardService.newDecoratedText().setText(
        '<font color="' + UI_COLORS.ERROR + '">' + errorMessage + "</font>"
      )
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Twenty for Gmail"))
    .addSection(section)
    .build();
}

/**
 * @description Builds the main sidebar card from the loaded sidebar state.
 *
 * Dispatches to error or rate-limit cards when appropriate, otherwise renders
 * the full sidebar with context info, entity selector, note/activity forms,
 * and account management. When no targets are matched, shows inline quick
 * create widgets instead of note/activity sections.
 *
 * @param {Object} state - The sidebar state from loadSidebarState.
 * @param {Object} options - Optional view options with quickCreateOptions for inline creation.
 * @returns {Object} A CardService Card instance for the sidebar.
 */
function buildSidebarMainCard(state, options) {
  if (state.status === SIDEBAR_STATUS.API_ERROR) {
    return buildApiErrorCard(state.messageContext, firstErrorMessage(state));
  }

  if (state.status === SIDEBAR_STATUS.RATE_LIMITED) {
    return buildRateLimitedCard(state.messageContext, firstErrorMessage(state));
  }

  const context = state.messageContext;
  const viewOptions = options || {};
  const quickCreateOptions = viewOptions.quickCreateOptions || {};
  const hasTargets = state.targets.length > 0;
  const contextSection = CardService.newCardSection();
  const adminSection = CardService.newCardSection();

  contextSection.addWidget(buildContextSummaryWidget(state));

  if (!state.person) {
    contextSection.addWidget(
      CardService.newDecoratedText()
        .setTopLabel("Email sender")
        .setText(context.fromEmail || "Unknown")
        .setBottomLabel(context.subject || "")
    );
  }

  contextSection.addWidget(
    CardService.newTextButton()
      .setText("Refresh")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName(ACTION_NAMES.REFRESH_CONTEXT)
          .setParameters(serializeContextParams(context))
      )
  );

  if (hasTargets) {
    contextSection.addWidget(buildTargetSelectionWidget(state.targets));
    contextSection.addWidget(
      CardService.newTextButton()
        .setText("New entity")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.OPEN_QUICK_CREATE_FORM)
            .setParameters(serializeContextParams(context))
        )
    );
  } else {
    contextSection.addWidget(
      CardService.newTextParagraph().setText("No match found. You can create an entity below.")
    );
    const quickCreateSection = CardService.newCardSection().addWidget(
      CardService.newTextParagraph().setText(
        "<b>New entity</b><br><i>Create an entity to enable Note and Activity actions.</i>"
      )
    );
    addInlineNoMatchWidgets(quickCreateSection, context, {
      createButtonText: "Create entity",
      quickCreateMode: QUICK_CREATE_MODE.INLINE,
      initialValues: quickCreateOptions.initialValues || {},
      personCompanyOptions: quickCreateOptions.personCompanyOptions || [],
      companySearchMessage: quickCreateOptions.companySearchMessage || "",
      companySearchError: quickCreateOptions.companySearchError || ""
    });
    adminSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="#92400E">Note and Activity are available after selecting an entity.</font>'
      )
    );
    adminSection.addWidget(CardService.newTextParagraph().setText("<b>Account</b>"));
    adminSection.addWidget(
      CardService.newTextButton()
        .setText("Reset token")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.RESET_TOKEN)
            .setParameters(serializeContextParams(context))
        )
    );
    addAppUrlWidgets(adminSection, context);
    if (state.status === SIDEBAR_STATUS.AMBIGUOUS_MATCH) {
      contextSection.addWidget(
        CardService.newTextParagraph().setText(
          '<font color="#92400E">Multiple company matches were found. Please select an entity manually.</font>'
        )
      );
    }

    return CardService.newCardBuilder()
      .setHeader(CardService.newCardHeader().setTitle("Twenty for Gmail"))
      .addSection(contextSection)
      .addSection(quickCreateSection)
      .addSection(adminSection)
      .build();
  }

  const noteSection = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText("<b>Note</b><br><i>Markdown is supported.</i>")
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName(FORM_FIELDS.NOTE_BODY)
        .setTitle("Note body")
        .setHint("Use Markdown: lists, links, bold text")
        .setMultiline(true)
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Create note")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.CREATE_NOTE)
            .setParameters(serializeContextParams(context))
        )
    );

  const activitySection = CardService.newCardSection()
    .addWidget(CardService.newTextParagraph().setText("<b>Activity</b>"))
    .addWidget(
      CardService.newTextInput()
        .setFieldName(FORM_FIELDS.ACTIVITY_TITLE)
        .setTitle("Activity title")
        .setHint("Follow-up call, product demo, and so on")
    )
    .addWidget(
      CardService.newTextInput()
        .setFieldName(FORM_FIELDS.ACTIVITY_DUE_DATE)
        .setTitle("Due date (optional)")
        .setHint("YYYY-MM-DD")
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Create activity")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.CREATE_ACTIVITY)
            .setParameters(serializeContextParams(context))
        )
    );

  adminSection.addWidget(CardService.newTextParagraph().setText("<b>Account</b>"));
  adminSection.addWidget(
    CardService.newTextButton()
      .setText("Reset token")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName(ACTION_NAMES.RESET_TOKEN)
          .setParameters(serializeContextParams(context))
      )
  );
  addAppUrlWidgets(adminSection, context);

  if (state.status === SIDEBAR_STATUS.AMBIGUOUS_MATCH) {
    contextSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="#92400E">Multiple company matches were found. Please select an entity manually.</font>'
      )
    );
  }

  if (state.status === SIDEBAR_STATUS.NO_MATCH) {
    contextSection.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="#92400E">No automatic match found. You can create an entity from this panel.</font>'
      )
    );
  }

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Twenty for Gmail"))
    .addSection(contextSection)
    .addSection(noteSection)
    .addSection(activitySection)
    .addSection(adminSection)
    .build();
}

/**
 * @description Builds the standalone quick-create card pushed onto the navigation stack.
 *
 * Renders a full entity creation form with entity type selector, name, email,
 * domain, company search, and optional opportunity-related inputs.
 *
 * @param {Object} context - The message context from extractMessageContext.
 * @param {Array<Object>} existingTargets - Currently matched targets for the related record dropdown.
 * @param {Object} options - Quick create display options (showOpportunity, showRelatedInput, initialValues).
 * @returns {Object} A CardService Card instance for the creation form.
 */
function buildQuickCreateCard(context, existingTargets, options) {
  const quickCreateOptions = options || {};
  const section = CardService.newCardSection();
  addQuickCreateWidgets(section, context, existingTargets, {
    createButtonText: "Create entity",
    quickCreateMode: QUICK_CREATE_MODE.CARD,
    showOpportunity: quickCreateOptions.showOpportunity !== false,
    showRelatedInput: quickCreateOptions.showRelatedInput !== false,
    initialValues: quickCreateOptions.initialValues || {},
    personCompanyOptions: quickCreateOptions.personCompanyOptions || [],
    companySearchMessage: quickCreateOptions.companySearchMessage || "",
    companySearchError: quickCreateOptions.companySearchError || ""
  });

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("New entity"))
    .addSection(section)
    .build();
}

/**
 * @description Adds inline entity creation widgets for the no-match sidebar state.
 *
 * Renders a simplified person+company form (no entity type selector, no opportunity)
 * pre-filled from the message context. Used when no CRM records match the sender.
 *
 * @param {Object} section - A CardService CardSection to append widgets to.
 * @param {Object} context - The message context for default values.
 * @param {Object} options - Widget options including initialValues, quickCreateMode, and createButtonText.
 */
function addInlineNoMatchWidgets(section, context, options) {
  const localOptions = options || {};
  const initialValues = localOptions.initialValues || {};
  const quickCreateMode = localOptions.quickCreateMode || QUICK_CREATE_MODE.INLINE;

  const personNameInput = CardService.newTextInput()
    .setFieldName(FORM_FIELDS.QUICK_NAME)
    .setTitle("Person name")
    .setHint("Required");
  if (isNonEmptyString(initialValues.name)) {
    personNameInput.setValue(initialValues.name);
  } else if (context && isNonEmptyString(context.fromName)) {
    personNameInput.setValue(context.fromName);
  }
  section.addWidget(personNameInput);

  const personEmailInput = CardService.newTextInput()
    .setFieldName(FORM_FIELDS.QUICK_EMAIL)
    .setTitle("Person email")
    .setHint("Required");
  if (isValidEmail(initialValues.email)) {
    personEmailInput.setValue(initialValues.email);
  } else if (context && isValidEmail(context.fromEmail)) {
    personEmailInput.setValue(context.fromEmail);
  }
  section.addWidget(personEmailInput);

  section.addWidget(CardService.newTextParagraph().setText("<b>Company (optional)</b>"));

  const fallbackDomain = isNonEmptyString(initialValues.domain)
    ? initialValues.domain
    : normalizeString(context && context.domain);
  const fallbackCompanyName = isNonEmptyString(initialValues.companyName)
    ? initialValues.companyName
    : deriveCompanyNameFromDomain(fallbackDomain);

  const companyNameInput = CardService.newTextInput()
    .setFieldName(FORM_FIELDS.QUICK_COMPANY_NAME)
    .setTitle("Company name")
    .setHint("Optional");
  if (isNonEmptyString(fallbackCompanyName)) {
    companyNameInput.setValue(fallbackCompanyName);
  }
  section.addWidget(companyNameInput);

  const companyDomainInput = CardService.newTextInput()
    .setFieldName(FORM_FIELDS.QUICK_DOMAIN)
    .setTitle("Company domain")
    .setHint("Optional");
  if (isNonEmptyString(fallbackDomain)) {
    companyDomainInput.setValue(fallbackDomain);
  }
  section.addWidget(companyDomainInput);

  addCompanySearchWidgets(section, context, quickCreateMode, localOptions);

  section.addWidget(
    CardService.newTextButton()
      .setText(localOptions.createButtonText || "Create entity")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName(ACTION_NAMES.CREATE_QUICK_ENTITY)
          .setParameters(buildQuickCreateActionParameters(context, quickCreateMode))
      )
  );
}

/**
 * @description Adds the full quick-create form widgets to a card section.
 *
 * Renders entity type dropdown, name, email, domain inputs, company search,
 * and an optional related record selector for opportunity creation. Pre-fills
 * values from context and initialValues.
 *
 * @param {Object} section - A CardService CardSection to append widgets to.
 * @param {Object} context - The message context for default values.
 * @param {Array<Object>} existingTargets - Matched targets for the related record dropdown.
 * @param {Object} options - Widget options (createButtonText, quickCreateMode, showOpportunity, showRelatedInput, initialValues).
 */
function addQuickCreateWidgets(section, context, existingTargets, options) {
  const localOptions = options || {};
  const createButtonText = localOptions.createButtonText || "Create entity";
  const showOpportunity = localOptions.showOpportunity !== false;
  const showRelatedInput = localOptions.showRelatedInput !== false;
  const quickCreateMode = localOptions.quickCreateMode || QUICK_CREATE_MODE.CARD;
  const initialValues = localOptions.initialValues || {};
  const selectedEntityType = resolveSelectedEntityType(initialValues.entityType, showOpportunity);
  const selectedRelatedRecord = normalizeString(initialValues.relatedRecordRef);
  const isPerson = selectedEntityType === ENTITY_TYPES.PERSON;
  const isCompany = selectedEntityType === ENTITY_TYPES.COMPANY;
  const isOpportunity = selectedEntityType === ENTITY_TYPES.OPPORTUNITY;

  const entityTypeInput = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Entity type")
    .setFieldName(FORM_FIELDS.QUICK_ENTITY_TYPE)
    .addItem("Person", ENTITY_TYPES.PERSON, selectedEntityType === ENTITY_TYPES.PERSON)
    .addItem("Company", ENTITY_TYPES.COMPANY, selectedEntityType === ENTITY_TYPES.COMPANY);

  if (showOpportunity) {
    entityTypeInput.addItem(
      "Opportunity",
      ENTITY_TYPES.OPPORTUNITY,
      selectedEntityType === ENTITY_TYPES.OPPORTUNITY
    );
  }

  entityTypeInput.setOnChangeAction(
    CardService.newAction()
      .setFunctionName(ACTION_NAMES.UPDATE_QUICK_CREATE_FORM)
      .setParameters(buildQuickCreateActionParameters(context, quickCreateMode))
  );
  section.addWidget(entityTypeInput);

  const nameTitle = isCompany ? "Company name" : isOpportunity ? "Opportunity name" : "Person name";
  const nameInput = CardService.newTextInput()
    .setFieldName(FORM_FIELDS.QUICK_NAME)
    .setTitle(nameTitle)
    .setHint("Required");
  if (isNonEmptyString(initialValues.name)) {
    nameInput.setValue(initialValues.name);
  } else if (context && isNonEmptyString(context.fromName)) {
    nameInput.setValue(context.fromName);
  }
  section.addWidget(nameInput);

  if (isPerson) {
    const emailInput = CardService.newTextInput()
      .setFieldName(FORM_FIELDS.QUICK_EMAIL)
      .setTitle("Person email")
      .setHint("Required");
    if (isValidEmail(initialValues.email)) {
      emailInput.setValue(initialValues.email);
    } else if (context && isValidEmail(context.fromEmail)) {
      emailInput.setValue(context.fromEmail);
    }
    section.addWidget(emailInput);
  }

  if (isCompany) {
    const domainInput = CardService.newTextInput()
      .setFieldName(FORM_FIELDS.QUICK_DOMAIN)
      .setTitle("Company domain")
      .setHint("Required");
    if (isNonEmptyString(initialValues.domain)) {
      domainInput.setValue(initialValues.domain);
    } else if (
      context &&
      isNonEmptyString(context.domain) &&
      !isGenericEmailDomain(context.domain)
    ) {
      domainInput.setValue(context.domain);
    }
    section.addWidget(domainInput);
  }

  if (isPerson) {
    addCompanySearchWidgets(section, context, quickCreateMode, localOptions);
  }

  if (showRelatedInput && isOpportunity) {
    section.addWidget(
      CardService.newTextParagraph().setText("<b>Related record (opportunity)</b>")
    );
    const relatedInput = CardService.newSelectionInput()
      .setType(CardService.SelectionInputType.DROPDOWN)
      .setFieldName(FORM_FIELDS.QUICK_RELATED_ID);
    relatedInput.addItem("No related record", "", !selectedRelatedRecord);
    (existingTargets || []).forEach((target) => {
      if (target.type === ENTITY_TYPES.PERSON || target.type === ENTITY_TYPES.COMPANY) {
        relatedInput.addItem(
          target.label + " (" + target.type + ")",
          target.type + ":" + target.id,
          selectedRelatedRecord === target.type + ":" + target.id
        );
      }
    });
    if (
      selectedRelatedRecord &&
      !(existingTargets || []).some(
        (target) => selectedRelatedRecord === target.type + ":" + target.id
      )
    ) {
      relatedInput.addItem("Selected record", selectedRelatedRecord, true);
    }
    section.addWidget(relatedInput);
  }

  section.addWidget(
    CardService.newTextButton()
      .setText(createButtonText)
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName(ACTION_NAMES.CREATE_QUICK_ENTITY)
          .setParameters(buildQuickCreateActionParameters(context, quickCreateMode))
      )
  );
}

/**
 * @description Builds the action parameters map for quick entity creation buttons.
 *
 * Merges serialized message context with the quick create mode flag so the
 * action handler knows whether the form was submitted from inline or card mode.
 *
 * @param {Object} context - The message context to serialize.
 * @param {string} quickCreateMode - One of QUICK_CREATE_MODE values (INLINE or CARD).
 * @returns {Object} A string-keyed parameters map for CardService setParameters.
 */
function buildQuickCreateActionParameters(context, quickCreateMode) {
  const parameters = serializeContextParams(context || {});
  parameters[UI_PARAM_KEYS.QUICK_CREATE_MODE] = quickCreateMode || QUICK_CREATE_MODE.CARD;
  return parameters;
}

/**
 * @description Adds company search and selection widgets to a card section.
 *
 * Renders a dropdown of recent and search-result companies, a text input for
 * searching by name/domain, a search button, and optional error/info messages.
 *
 * @param {Object} section - A CardService CardSection to append widgets to.
 * @param {Object} context - The message context for action parameters.
 * @param {string} quickCreateMode - One of QUICK_CREATE_MODE values.
 * @param {Object} options - Options with personCompanyOptions, initialValues, companySearchMessage, companySearchError.
 */
function addCompanySearchWidgets(section, context, quickCreateMode, options) {
  const localOptions = options || {};
  const initialValues = localOptions.initialValues || {};
  const selectedPersonCompanyId = normalizeString(initialValues.personCompanyId);

  section.addWidget(
    CardService.newTextParagraph().setText(
      "<b>Person company (optional)</b><br><i>Select one, or search by name/domain.</i>"
    )
  );

  const personCompanyOptions = buildPersonCompanyOptions(localOptions.personCompanyOptions || []);
  const personCompanySelection = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setFieldName(FORM_FIELDS.QUICK_PERSON_COMPANY_ID);
  personCompanySelection.addItem("No selection", "", !selectedPersonCompanyId);
  personCompanyOptions.forEach((option) => {
    personCompanySelection.addItem(option.label, option.id, option.id === selectedPersonCompanyId);
  });
  if (
    selectedPersonCompanyId &&
    !personCompanyOptions.some((option) => option.id === selectedPersonCompanyId)
  ) {
    personCompanySelection.addItem("Selected company", selectedPersonCompanyId, true);
  }
  section.addWidget(personCompanySelection);

  const companySearchInput = CardService.newTextInput()
    .setFieldName(FORM_FIELDS.QUICK_COMPANY_SEARCH)
    .setTitle("Search company")
    .setHint("Type at least 3 characters");
  if (isNonEmptyString(initialValues.companySearchQuery)) {
    companySearchInput.setValue(initialValues.companySearchQuery);
  }
  section.addWidget(companySearchInput);

  section.addWidget(
    CardService.newTextButton()
      .setText("Search company")
      .setOnClickAction(
        CardService.newAction()
          .setFunctionName(ACTION_NAMES.SEARCH_COMPANY)
          .setParameters(buildQuickCreateActionParameters(context, quickCreateMode))
      )
  );

  if (isNonEmptyString(localOptions.companySearchError)) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' + UI_COLORS.ERROR + '">' + localOptions.companySearchError + "</font>"
      )
    );
  } else if (isNonEmptyString(localOptions.companySearchMessage)) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' + UI_COLORS.WARNING + '">' + localOptions.companySearchMessage + "</font>"
      )
    );
  }
}

/**
 * @description Resolves the selected entity type for the quick-create form dropdown.
 *
 * Returns the given entityType if it's a valid selection, defaulting to PERSON
 * when the type is unset or when OPPORTUNITY is selected but not available.
 *
 * @param {string} entityType - The entity type value from form state.
 * @param {boolean} showOpportunity - Whether the opportunity option is enabled.
 * @returns {string} The resolved entity type constant.
 */
function resolveSelectedEntityType(entityType, showOpportunity) {
  if (entityType === ENTITY_TYPES.PERSON || entityType === ENTITY_TYPES.COMPANY) {
    return entityType;
  }
  if (entityType === ENTITY_TYPES.OPPORTUNITY && showOpportunity) {
    return entityType;
  }
  return ENTITY_TYPES.PERSON;
}

/**
 * @description Builds a deduplicated list of company options for the person-company dropdown.
 *
 * Merges recently-used companies (from UserProperties) with search-result options,
 * deduplicates by ID, and caps at 20 items. Recent companies appear first.
 *
 * @param {Array<Object>} inputOptions - Company option objects from search results.
 * @returns {Array<Object>} Deduplicated options with id and label fields, max 20 items.
 */
function buildPersonCompanyOptions(inputOptions) {
  const seen = {};
  const merged = [];

  function pushOption(option) {
    if (!option || !isNonEmptyString(option.id)) {
      return;
    }
    const key = String(option.id);
    if (seen[key]) {
      return;
    }
    seen[key] = true;
    merged.push({
      id: key,
      label: isNonEmptyString(option.label) ? option.label : "Company " + key
    });
  }

  loadRecentCompanies().forEach((company) => {
    pushOption({
      id: company.id,
      label: formatCompanyLabel(company)
    });
  });

  (inputOptions || []).forEach((option) => {
    pushOption(normalizeCompanyOption(option));
  });

  return merged.slice(0, 20);
}

/**
 * @description Normalizes a raw company option into a standardized {id, label} object.
 *
 * If the option already has a label, uses it directly. Otherwise, builds a label
 * from the company's name and domain using formatCompanyLabel and extractCompanyDomain.
 *
 * @param {Object} option - A company object with at least an id field.
 * @returns {Object|null} A normalized option with id and label, or null if invalid.
 */
function normalizeCompanyOption(option) {
  if (!option) {
    return null;
  }

  const id = isNonEmptyString(option.id) ? String(option.id) : "";
  if (!id) {
    return null;
  }

  if (isNonEmptyString(option.label)) {
    return { id: id, label: option.label };
  }

  return {
    id: id,
    label: formatCompanyLabel({
      id: id,
      name: option.name,
      domain: extractCompanyDomain(option)
    })
  };
}

/**
 * @description Builds an error card with a red message and a retry button.
 * @param {Object} context - The message context for the retry action.
 * @param {string} message - The error message to display.
 * @returns {Object} A CardService Card instance showing the error.
 */
function buildApiErrorCard(context, message) {
  const section = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' + UI_COLORS.ERROR + '">' + (message || "Unexpected API error.") + "</font>"
      )
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Retry")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.REFRESH_CONTEXT)
            .setParameters(serializeContextParams(context))
        )
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Reset token")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.RESET_TOKEN)
            .setParameters(serializeContextParams(context))
        )
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Twenty for Gmail"))
    .addSection(section)
    .build();
}

/**
 * @description Builds a rate-limit warning card with an amber message and refresh button.
 * @param {Object} context - The message context for the refresh action.
 * @param {string} message - The rate-limit message to display.
 * @returns {Object} A CardService Card instance showing the rate-limit warning.
 */
function buildRateLimitedCard(context, message) {
  const section = CardService.newCardSection()
    .addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' +
          UI_COLORS.WARNING +
          '">' +
          (message || "Rate limit reached. Please try again shortly.") +
          "</font>"
      )
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Refresh")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.REFRESH_CONTEXT)
            .setParameters(serializeContextParams(context))
        )
    )
    .addWidget(
      CardService.newTextButton()
        .setText("Reset token")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.RESET_TOKEN)
            .setParameters(serializeContextParams(context))
        )
    );

  return CardService.newCardBuilder()
    .setHeader(CardService.newCardHeader().setTitle("Twenty for Gmail"))
    .addSection(section)
    .build();
}

/**
 * @description Builds a dropdown widget for selecting among matched target entities.
 *
 * Each item displays the target label with its type in parentheses. The first
 * target is selected by default.
 *
 * @param {Array<Object>} targets - Target objects with type, id, and label fields.
 * @returns {Object} A CardService SelectionInput widget configured as a dropdown.
 */
function buildTargetSelectionWidget(targets) {
  const selection = CardService.newSelectionInput()
    .setType(CardService.SelectionInputType.DROPDOWN)
    .setTitle("Entity")
    .setFieldName(FORM_FIELDS.TARGET_ENTITY);

  targets.forEach((target, index) => {
    selection.addItem(
      target.label + " (" + target.type + ")",
      target.type + ":" + target.id,
      index === 0
    );
  });

  return selection;
}

/**
 * @description Extracts the first error message from a sidebar state's errors array.
 * @param {Object} state - The sidebar state with an errors array.
 * @returns {string} The first error message, or empty string if none.
 */
function firstErrorMessage(state) {
  if (!state || !state.errors || !state.errors.length) {
    return "";
  }
  return state.errors[0].message || "";
}

/**
 * @description Builds an ActionResponse that replaces the current card in the sidebar.
 * @param {Object} card - A CardService Card to display.
 * @returns {Object} A CardService ActionResponse with updateCard navigation.
 */
function buildUpdateCardActionResponse(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().updateCard(card))
    .build();
}

/**
 * @description Builds an ActionResponse that pushes a new card onto the navigation stack.
 * @param {Object} card - A CardService Card to push.
 * @returns {Object} A CardService ActionResponse with pushCard navigation.
 */
function buildPushCardActionResponse(card) {
  return CardService.newActionResponseBuilder()
    .setNavigation(CardService.newNavigation().pushCard(card))
    .build();
}

/**
 * @description Adds workspace URL configuration widgets to a card section.
 *
 * Shows the current workspace URL with a reset button if one is stored,
 * or a text input and save button if not yet configured.
 *
 * @param {Object} section - A CardService CardSection to append widgets to.
 * @param {Object} context - The message context for action parameters.
 */
function addAppUrlWidgets(section, context) {
  const storedUrl = normalizeString(
    PropertiesService.getUserProperties().getProperty(
      USER_APP_URL_PROPERTY_NAMESPACE + ":" + getCurrentUserEmailSafe().toLowerCase()
    )
  );

  section.addWidget(CardService.newTextParagraph().setText("<b>Workspace URL</b>"));

  if (storedUrl) {
    section.addWidget(
      CardService.newTextParagraph().setText(
        '<font color="' + UI_COLORS.MUTED + '">' + storedUrl + "</font>"
      )
    );
    section.addWidget(
      CardService.newTextButton()
        .setText("Reset workspace URL")
        .setOnClickAction(
          CardService.newAction()
            .setFunctionName(ACTION_NAMES.RESET_APP_URL)
            .setParameters(serializeContextParams(context))
        )
    );
  } else {
    section
      .addWidget(
        CardService.newTextInput()
          .setFieldName(FORM_FIELDS.APP_URL)
          .setTitle("Twenty workspace URL")
          .setHint("e.g. my-workspace or my-workspace.twenty.com")
      )
      .addWidget(
        CardService.newTextButton()
          .setText("Save workspace URL")
          .setOnClickAction(
            CardService.newAction()
              .setFunctionName(ACTION_NAMES.SAVE_APP_URL)
              .setParameters(serializeContextParams(context))
          )
      );
  }
}

/**
 * @description Builds an ActionResponse that shows a temporary notification toast.
 * @param {string} text - The notification message text.
 * @returns {Object} A CardService ActionResponse with a notification.
 */
function buildNotificationActionResponse(text) {
  return CardService.newActionResponseBuilder()
    .setNotification(CardService.newNotification().setText(text))
    .build();
}

/**
 * @description Checks whether an opportunity is considered active (not closed).
 *
 * Treats an opportunity as inactive when its stage field contains "CLOSED"
 * (case-insensitive), covering Twenty's default CLOSED_WON and CLOSED_LOST stages.
 * Opportunities with no stage set are treated as active.
 *
 * @param {Object} opportunity - A Twenty CRM opportunity record.
 * @returns {boolean} True if the opportunity is active, false if closed.
 */
function isOpportunityActive(opportunity) {
  const stage = normalizeString(opportunity && opportunity.stage).toUpperCase();
  if (!stage) {
    return true;
  }
  return stage.indexOf("CLOSED") === -1;
}

/**
 * @description Builds an HTML anchor link to a Twenty CRM entity record.
 * @param {string} label - The link display text.
 * @param {string} entityType - One of ENTITY_TYPES values.
 * @param {string} id - The entity record ID.
 * @returns {string} An HTML anchor tag string.
 */
function buildEntityLink(label, entityType, id) {
  const paths = {
    person: "/object/person/",
    company: "/object/company/",
    opportunity: "/object/opportunity/"
  };
  const path = paths[entityType] || "/objects/";
  return '<a href="' + getUserAppUrl() + path + id + '">' + label + "</a>";
}

/**
 * @description Builds a compact CRM status summary TextParagraph for the sidebar header.
 *
 * Renders 3–4 lines showing whether a contact, company, and opportunities were
 * found for the email sender. Uses ☑ for present records and ∅ for absent ones.
 * Names are linked to their respective Twenty CRM entity pages.
 * Closed opportunities are shown on a separate ◻ line if any exist.
 *
 * @param {Object} state - The sidebar state from loadSidebarState.
 * @returns {Object} A CardService TextParagraph widget with the summary text.
 */
function buildContextSummaryWidget(state) {
  const lines = [];

  if (state.person) {
    const name = getEntityDisplayName(state.person, ENTITY_TYPES.PERSON);
    lines.push("☑ " + buildEntityLink(name, ENTITY_TYPES.PERSON, state.person.id));
  } else {
    lines.push('<font color="' + UI_COLORS.MUTED + '">∅ (No contact)</font>');
  }

  if (state.company) {
    const name = getEntityDisplayName(state.company, ENTITY_TYPES.COMPANY);
    lines.push("☑ " + buildEntityLink(name, ENTITY_TYPES.COMPANY, state.company.id));
  } else {
    lines.push('<font color="' + UI_COLORS.MUTED + '">∅ (No company)</font>');
  }

  const activeOpps = (state.opportunities || []).filter(isOpportunityActive);
  const closedOpps = (state.opportunities || []).filter((opp) => !isOpportunityActive(opp));

  if (activeOpps.length > 0) {
    const oppLinks = activeOpps
      .map((opp) =>
        buildEntityLink(
          getEntityDisplayName(opp, ENTITY_TYPES.OPPORTUNITY),
          ENTITY_TYPES.OPPORTUNITY,
          opp.id
        )
      )
      .join(", ");
    lines.push("☑ " + oppLinks);
  } else {
    lines.push('<font color="' + UI_COLORS.MUTED + '">∅ (No opportunities)</font>');
  }

  if (closedOpps.length > 0) {
    const closedLinks = closedOpps
      .map((opp) =>
        buildEntityLink(
          getEntityDisplayName(opp, ENTITY_TYPES.OPPORTUNITY),
          ENTITY_TYPES.OPPORTUNITY,
          opp.id
        )
      )
      .join(", ");
    lines.push('<font color="' + UI_COLORS.MUTED + '">◻ ' + closedLinks + "</font>");
  }

  return CardService.newTextParagraph().setText(lines.join("<br>"));
}
