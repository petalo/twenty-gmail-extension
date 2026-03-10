/**
 * @file constants.js - Application-wide constants and configuration values.
 *
 * Centralizes API base URL, property-storage namespaces, UI enums, form field
 * names, entity types, and cache TTLs used throughout the add-on.
 */

const TWENTY_BASE_URL = "https://api.twenty.com";
// Fallback app URL used when no workspace URL has been configured by the user.
const TWENTY_APP_URL = "https://app.twenty.com";
const EXTENSION_REPOSITORY_URL = "https://github.com/petalo/twenty-gmail-extension";

const USER_TOKEN_PROPERTY_NAMESPACE = "twenty_api_token";
const USER_APP_URL_PROPERTY_NAMESPACE = "twenty_app_url";
const USER_RECENT_COMPANIES_PROPERTY_NAMESPACE = "twenty_recent_companies";
const RECENT_COMPANIES_LIMIT = 8;

const GENERIC_EMAIL_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "yahoo.com",
  "icloud.com"
];

const SIDEBAR_STATUS = {
  LOADING: "loading",
  MATCHED: "matched",
  NO_MATCH: "no_match",
  AMBIGUOUS_MATCH: "ambiguous_match",
  REFRESHING: "refreshing",
  API_ERROR: "api_error",
  RATE_LIMITED: "rate_limited"
};

const UI_COLORS = {
  ERROR: "#B91C1C",
  WARNING: "#92400E",
  SUCCESS: "#065F46",
  MUTED: "#6B7280"
};

const ACTION_NAMES = {
  SAVE_API_TOKEN: "onSaveApiToken",
  SAVE_APP_URL: "onSaveAppUrl",
  OPEN_MESSAGE_CONTEXT: "onOpenMessageContext",
  REFRESH_CONTEXT: "onRefreshContext",
  OPEN_QUICK_CREATE_FORM: "onOpenQuickCreateForm",
  UPDATE_QUICK_CREATE_FORM: "onUpdateQuickCreateForm",
  SEARCH_COMPANY: "onSearchCompany",
  CREATE_QUICK_ENTITY: "onCreateQuickEntity",
  CREATE_NOTE: "onCreateNote",
  CREATE_ACTIVITY: "onCreateActivity",
  RESET_TOKEN: "onResetApiToken",
  RESET_APP_URL: "onResetAppUrl"
};

const FORM_FIELDS = {
  API_TOKEN: "apiToken",
  APP_URL: "appUrl",
  TARGET_ENTITY: "targetEntity",
  NOTE_BODY: "noteBody",
  ACTIVITY_TITLE: "activityTitle",
  ACTIVITY_DUE_DATE: "activityDueDate",
  QUICK_ENTITY_TYPE: "quickEntityType",
  QUICK_NAME: "quickName",
  QUICK_EMAIL: "quickEmail",
  QUICK_COMPANY_NAME: "quickCompanyName",
  QUICK_DOMAIN: "quickDomain",
  QUICK_RELATED_ID: "quickRelatedRecordId",
  QUICK_PERSON_COMPANY_ID: "quickPersonCompanyId",
  QUICK_COMPANY_SEARCH: "quickCompanySearch"
};

const QUICK_CREATE_MODE = {
  INLINE: "inline",
  CARD: "card"
};

const UI_PARAM_KEYS = {
  QUICK_CREATE_MODE: "quickCreateMode"
};

const ENTITY_TYPES = {
  PERSON: "person",
  COMPANY: "company",
  OPPORTUNITY: "opportunity"
};

const HTTP_METHOD = {
  GET: "get",
  POST: "post",
  DELETE: "delete"
};

const TASK_STATUS = {
  TODO: "TODO"
};

const TOKEN_VALIDATION_CACHE_TTL_SECONDS = 300;
const SIDEBAR_STATE_CACHE_TTL_SECONDS = 90;
