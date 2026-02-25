/**
 * @file context.js - Gmail message context extraction and serialization.
 *
 * Parses the Gmail add-on event object to build a structured message context
 * containing sender info, thread/message IDs, and email domain.
 */

/**
 * @description Extracts a structured message context from a Gmail add-on event.
 *
 * Reads sender, subject, and thread information from both the event's gmail
 * object and serialized parameters, falling back between them as needed.
 *
 * @param {Object} e - The Gmail add-on event object.
 * @returns {Object} A message context with correlationId, gmailUserEmail, messageId,
 *   threadId, fromEmail, fromName, fromHeader, subject, sentAt, and domain.
 */
function extractMessageContext(e) {
  const correlationId = createCorrelationId();
  const gmailUserEmail = getCurrentUserEmailSafe();
  const eventGmail = (e && e.gmail) || {};
  const params = (e && e.parameters) || {};

  const messageId = eventGmail.messageId || params.messageId || "";
  let threadId = eventGmail.threadId || params.threadId || "";

  let fromHeader = params.fromHeader || "";
  let subject = params.subject || "";
  let sentAt = params.sentAt || "";

  try {
    if (eventGmail.accessToken) {
      GmailApp.setCurrentMessageAccessToken(eventGmail.accessToken);
    }

    if (messageId) {
      const message = GmailApp.getMessageById(messageId);
      if (message) {
        fromHeader = fromHeader || message.getFrom();
        subject = subject || message.getSubject();
        sentAt = sentAt || message.getDate().toISOString();
        if (!threadId && message.getThread()) {
          threadId = message.getThread().getId();
        }
      }
    }
  } catch (error) {
    logError("extractMessageContext", error, {
      correlationId: correlationId,
      messageId: messageId,
      threadId: threadId
    });
  }

  const sender = parseFromHeader(fromHeader || params.fromEmail || "");
  const domain = extractEmailDomain(sender.email);

  return {
    correlationId: correlationId,
    gmailUserEmail: gmailUserEmail,
    messageId: messageId,
    threadId: threadId,
    fromEmail: sender.email,
    fromName: sender.name,
    fromHeader: fromHeader,
    subject: subject,
    sentAt: sentAt,
    domain: domain
  };
}

/**
 * @description Parses an RFC 5322 "From" header into name and email parts.
 * @param {string} fromHeader - A From header like '"Jane Doe" <jane@example.com>'.
 * @returns {Object} An object with name and email string properties.
 */
function parseFromHeader(fromHeader) {
  const fallback = {
    name: "",
    email: normalizeString(fromHeader).toLowerCase()
  };

  if (!isNonEmptyString(fromHeader)) {
    return fallback;
  }

  const match = fromHeader.match(/^(.*)<([^>]+)>$/);
  if (!match) {
    return fallback;
  }

  const name = normalizeString(match[1]).replace(/^"|"$/g, "");
  const email = normalizeString(match[2]).toLowerCase();

  return {
    name: name,
    email: email
  };
}

/**
 * @description Extracts the domain portion from an email address.
 * @param {string} email - A valid email address.
 * @returns {string} The lowercase domain, or empty string if the email is invalid.
 */
function extractEmailDomain(email) {
  if (!isValidEmail(email)) {
    return "";
  }

  return email.split("@")[1].toLowerCase();
}

/**
 * @description Checks whether a domain belongs to a generic email provider.
 * @param {string} domain - An email domain to check (e.g. "gmail.com").
 * @returns {boolean} True if the domain is generic or blank, false otherwise.
 */
function isGenericEmailDomain(domain) {
  if (!isNonEmptyString(domain)) {
    return true;
  }

  return GENERIC_EMAIL_DOMAINS.includes(domain.toLowerCase());
}

/**
 * @description Serializes a message context into a flat string-keyed map for CardService action parameters.
 * @param {Object} context - The message context object.
 * @returns {Object} A plain object suitable for CardService setParameters().
 */
function serializeContextParams(context) {
  return {
    messageId: context.messageId || "",
    threadId: context.threadId || "",
    fromHeader: context.fromHeader || "",
    subject: context.subject || "",
    sentAt: context.sentAt || ""
  };
}

/**
 * @description Safely retrieves the current Gmail user's email address.
 * @returns {string} The user's email, or "unknown-user" if unavailable.
 */
function getCurrentUserEmailSafe() {
  try {
    return Session.getActiveUser().getEmail() || "unknown-user";
  } catch (error) {
    logError("getCurrentUserEmailSafe", error, {});
    return "unknown-user";
  }
}
