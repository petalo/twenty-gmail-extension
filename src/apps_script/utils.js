/**
 * @file utils.js - Shared company-related helper functions.
 *
 * Provides domain normalization, company label formatting, and domain-to-name
 * derivation logic used by both UI rendering and action handlers.
 */

/**
 * @description Builds a human-readable label for a company record.
 * @param {Object} company - A company object with optional name, domain, and id fields.
 * @returns {string} A label such as "Acme (acme.com)" or a fallback like "Company {id}".
 */
function formatCompanyLabel(company) {
  const name = normalizeString(company && company.name);
  const domain = normalizeString(company && company.domain);
  const id = normalizeString(company && company.id);

  if (name && domain) {
    return name + " (" + domain + ")";
  }
  if (name) {
    return name;
  }
  if (domain) {
    return domain;
  }
  return "Company " + id;
}

/**
 * @description Extracts the best available domain string from a company record.
 *
 * Checks multiple field locations in priority order: domain, domainName.primaryLinkUrl,
 * domainName.value, websiteUrl, and primaryLinkUrl.
 *
 * @param {Object} company - A Twenty CRM company record.
 * @returns {string} The domain string, or empty string if none found.
 */
function extractCompanyDomain(company) {
  if (!company) {
    return "";
  }

  if (isNonEmptyString(company.domain)) {
    return company.domain;
  }
  if (company.domainName && isNonEmptyString(company.domainName.primaryLinkUrl)) {
    return company.domainName.primaryLinkUrl;
  }
  if (company.domainName && isNonEmptyString(company.domainName.value)) {
    return company.domainName.value;
  }
  if (isNonEmptyString(company.websiteUrl)) {
    return company.websiteUrl;
  }
  if (isNonEmptyString(company.primaryLinkUrl)) {
    return company.primaryLinkUrl;
  }

  return "";
}

/**
 * @description Normalizes a raw domain or URL input to a bare hostname.
 *
 * Strips protocol, www prefix, path, query string, fragment, and port.
 *
 * @param {string} value - A domain, URL, or partial input string.
 * @returns {string} The normalized hostname, or empty string if input is blank.
 */
function normalizeDomainInput(value) {
  const normalized = normalizeString(value).toLowerCase();
  if (!normalized) {
    return "";
  }

  return normalized
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split("/")[0]
    .split("?")[0]
    .split("#")[0]
    .split(":")[0];
}

/**
 * @description Derives a capitalized company name from a domain string.
 *
 * Extracts the second-level domain label (e.g. "acme" from "acme.com") and
 * capitalizes its first letter. Handles compound TLDs like .co.uk.
 *
 * @param {string} domain - A domain name or URL.
 * @returns {string} The derived company name, or empty string if not derivable.
 */
function deriveCompanyNameFromDomain(domain) {
  const normalizedDomain = normalizeDomainInput(domain);
  if (!normalizedDomain) {
    return "";
  }

  const parts = normalizedDomain.split(".").filter(Boolean);
  if (parts.length === 0) {
    return "";
  }

  let candidate = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  if (
    parts.length >= 3 &&
    (candidate === "co" || candidate === "com" || candidate === "org" || candidate === "net")
  ) {
    candidate = parts[parts.length - 3];
  }

  if (!candidate) {
    return "";
  }

  return candidate.charAt(0).toUpperCase() + candidate.slice(1);
}
