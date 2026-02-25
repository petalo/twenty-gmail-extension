const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function createStatefulPropertiesService() {
  const store = {};
  return {
    getUserProperties: () => ({
      getProperty: (key) => store[key] || null,
      setProperty: (key, value) => { store[key] = value; },
      deleteProperty: (key) => { delete store[key]; }
    })
  };
}

function createAppsScriptLikeContext() {
  const context = {
    console: console,
    UrlFetchApp: {
      fetch: () => {
        throw new Error("UrlFetchApp.fetch is not available in unit tests.");
      }
    },
    CacheService: {
      getUserCache: () => ({
        get: () => null,
        put: () => {}
      })
    },
    PropertiesService: {
      getUserProperties: () => ({
        getProperty: () => "",
        setProperty: () => {},
        deleteProperty: () => {}
      })
    },
    Utilities: {
      DigestAlgorithm: {
        SHA_256: "SHA_256"
      },
      computeDigest: () => []
    },
    Session: {
      getActiveUser: () => ({
        getEmail: () => "unit-test@example.com"
      })
    },
    GmailApp: {},
    CardService: {},
    logInfo: () => {},
    logError: () => {}
  };

  vm.createContext(context);
  return context;
}

function loadAppsScriptFiles(context, files) {
  files.forEach((file) => {
    const fullPath = path.resolve(process.cwd(), file);
    const source = fs.readFileSync(fullPath, "utf8");
    vm.runInContext(source, context, { filename: file });
  });
}

const runtime = createAppsScriptLikeContext();
loadAppsScriptFiles(runtime, [
  "src/apps_script/constants.js",
  "src/apps_script/validation.js",
  "src/apps_script/utils.js",
  "src/apps_script/logging.js",
  "src/apps_script/context.js",
  "src/apps_script/auth.js",
  "src/apps_script/twenty_client.js",
  "src/apps_script/actions.js"
]);

function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildFetchResponse(statusCode, body) {
  return {
    getResponseCode: () => statusCode,
    getContentText: () => JSON.stringify(body || {})
  };
}

function mockFetchSequence(sequence) {
  let callCount = 0;
  runtime.UrlFetchApp.fetch = () => {
    if (callCount >= sequence.length) {
      throw new Error("Unexpected fetch call at index " + callCount);
    }
    const current = sequence[callCount];
    callCount += 1;
    return buildFetchResponse(current.statusCode, current.body);
  };

  return () => callCount;
}

test("normalizeDomainInput strips protocol, path and port", () => {
  assert.equal(
    runtime.normalizeDomainInput("https://www.Example.com:8080/path?q=1#hash"),
    "example.com"
  );
});

test("deriveCompanyNameFromDomain handles simple and compound TLD domains", () => {
  assert.equal(runtime.deriveCompanyNameFromDomain("acmecorp.io"), "Acmecorp");
  assert.equal(runtime.deriveCompanyNameFromDomain("https://acme.co.uk"), "Acme");
});

test("validateQuickEntityInput validates person/company/opportunity payloads", () => {
  assert.deepEqual(
    toPlain(
      runtime.validateQuickEntityInput("person", {
        name: "Sofia",
        email: "invalid-email",
        domain: "",
        relatedRecordRef: ""
      })
    ),
    { ok: false, message: "A valid email is required for person creation." }
  );

  assert.deepEqual(
    toPlain(
      runtime.validateQuickEntityInput("company", {
        name: "Acme",
        email: "",
        domain: "",
        relatedRecordRef: ""
      })
    ),
    { ok: false, message: "Company domain is required." }
  );

  assert.deepEqual(
    toPlain(
      runtime.validateQuickEntityInput("opportunity", {
        name: "Deal",
        email: "",
        domain: "",
        relatedRecordRef: ""
      })
    ),
    {
      ok: false,
      message: "A related person or company is required for opportunity creation."
    }
  );
});

test("buildTargetPayload maps entity types to expected target keys", () => {
  assert.deepEqual(toPlain(runtime.buildTargetPayload("person", "p1")), { targetPersonId: "p1" });
  assert.deepEqual(toPlain(runtime.buildTargetPayload("company", "c1")), { targetCompanyId: "c1" });
  assert.deepEqual(toPlain(runtime.buildTargetPayload("opportunity", "o1")), {
    targetOpportunityId: "o1"
  });
  assert.equal(runtime.buildTargetPayload("unknown", "x1"), null);
});

test("extractCreatedEntityId supports common response envelopes", () => {
  assert.equal(runtime.extractCreatedEntityId({ id: "direct-id" }, "createTask"), "direct-id");

  assert.equal(
    runtime.extractCreatedEntityId(
      {
        data: {
          createTask: {
            id: "task-id"
          }
        }
      },
      "createTask"
    ),
    "task-id"
  );

  assert.equal(
    runtime.extractCreatedEntityId(
      {
        data: {
          arbitraryKey: {
            id: "fallback-id"
          }
        }
      },
      "createTask"
    ),
    "fallback-id"
  );
});

test("extractRecords ignores primitive arrays and returns nested object records", () => {
  const response = {
    data: {
      metadata: ["a", "b"],
      companies: {
        edges: [{ node: { id: "c1", name: "Acme" } }, { node: { id: "c2", name: "Beta" } }]
      }
    }
  };

  assert.deepEqual(toPlain(runtime.extractRecords(response)), [
    { id: "c1", name: "Acme" },
    { id: "c2", name: "Beta" }
  ]);
});

test("extractRecords returns empty array for primitive-only payloads", () => {
  const response = {
    data: ["limit", "filter", "sort"]
  };

  assert.deepEqual(toPlain(runtime.extractRecords(response)), []);
});

test("extractRecords ignores object arrays without ids", () => {
  const response = {
    data: {
      metadata: [{ key: "limit", value: 5 }, { key: "filter", value: "email" }]
    }
  };

  assert.deepEqual(toPlain(runtime.extractRecords(response)), []);
});

test("buildRequestLogDetails excludes query values to avoid PII leakage", () => {
  const details = toPlain(
    runtime.buildRequestLogDetails(
      "/rest/people?limit=5&filter=emails.primaryEmail%5Beq%5D%3Afoo%40bar.com&limit=5",
      "get"
    )
  );

  assert.equal(details.endpoint, "https://api.twenty.com/rest/people");
  assert.equal(details.method, "get");
  assert.deepEqual(details.queryKeys, ["limit", "filter"]);
});

test("validateNoteInput rejects malformed target references", () => {
  assert.deepEqual(toPlain(runtime.validateNoteInput("body", "person")), {
    ok: false,
    message: "Selected target entity is invalid."
  });
});

test("validateActivityInput validates optional due date", () => {
  assert.deepEqual(toPlain(runtime.validateActivityInput("Follow up", "person:p1", "2026-02-31")), {
    ok: false,
    message: "Due date must use YYYY-MM-DD format."
  });

  assert.deepEqual(toPlain(runtime.validateActivityInput("Follow up", "person:p1", "2026-02-28")), {
    ok: true,
    message: ""
  });
});

test("createNote rolls back note when noteTarget linking fails", () => {
  const getCallCount = mockFetchSequence([
    {
      statusCode: 201,
      body: { data: { createNote: { id: "note-1" } } }
    },
    {
      statusCode: 400,
      body: { error: "bad target" }
    },
    {
      statusCode: 200,
      body: { data: { deleteNote: { id: "note-1" } } }
    }
  ]);

  const result = toPlain(
    runtime.createNote(
      {
        title: "Note",
        body: "Body",
        targetType: "person",
        targetId: "person-1"
      },
      "token"
    )
  );

  assert.equal(getCallCount(), 3);
  assert.equal(result.ok, false);
  assert.equal(result.rollbackAttempted, true);
  assert.equal(result.rollbackOk, true);
});

test("createActivity rolls back task when taskTarget linking fails", () => {
  const getCallCount = mockFetchSequence([
    {
      statusCode: 201,
      body: { data: { createTask: { id: "task-1" } } }
    },
    {
      statusCode: 500,
      body: { error: "server error" }
    },
    {
      statusCode: 200,
      body: { data: { deleteTask: { id: "task-1" } } }
    }
  ]);

  const result = toPlain(
    runtime.createActivity(
      {
        title: "Activity",
        dueDate: "2026-03-01",
        body: "Body",
        targetType: "company",
        targetId: "company-1"
      },
      "token"
    )
  );

  assert.equal(getCallCount(), 3);
  assert.equal(result.ok, false);
  assert.equal(result.rollbackAttempted, true);
  assert.equal(result.rollbackOk, true);
});

// ---------------------------------------------------------------------------
// validation.js — happy paths
// ---------------------------------------------------------------------------

test("validateQuickEntityInput returns ok for a valid person", () => {
  const result = toPlain(
    runtime.validateQuickEntityInput("person", {
      name: "Sofia Perez",
      email: "sofia@example.com",
      domain: "",
      relatedRecordRef: ""
    })
  );
  assert.deepEqual(result, { ok: true, message: "" });
});

test("validateQuickEntityInput returns ok for a valid company", () => {
  const result = toPlain(
    runtime.validateQuickEntityInput("company", {
      name: "Acme Corp",
      email: "",
      domain: "acme.com",
      relatedRecordRef: ""
    })
  );
  assert.deepEqual(result, { ok: true, message: "" });
});

test("validateNoteInput returns ok for valid input", () => {
  const result = toPlain(runtime.validateNoteInput("body text", "person:p1"));
  assert.deepEqual(result, { ok: true, message: "" });
});

// ---------------------------------------------------------------------------
// validation.js — edge cases
// ---------------------------------------------------------------------------

test("isValidEmail returns false for empty string, @, user@, @domain", () => {
  assert.equal(runtime.isValidEmail(""), false);
  assert.equal(runtime.isValidEmail("@"), false);
  assert.equal(runtime.isValidEmail("user@"), false);
  assert.equal(runtime.isValidEmail("@domain"), false);
});

test("isValidEmail returns true for user@example.com", () => {
  assert.equal(runtime.isValidEmail("user@example.com"), true);
});

// ---------------------------------------------------------------------------
// auth.js — token persistence with stateful PropertiesService
// ---------------------------------------------------------------------------

test("saveUserApiToken then getUserApiToken round-trips the token", () => {
  const originalProps = runtime.PropertiesService;
  runtime.PropertiesService = createStatefulPropertiesService();
  try {
    runtime.saveUserApiToken("test-token-123");
    assert.equal(runtime.getUserApiToken(), "test-token-123");
  } finally {
    runtime.PropertiesService = originalProps;
  }
});

test("clearUserApiToken removes the persisted token", () => {
  const originalProps = runtime.PropertiesService;
  runtime.PropertiesService = createStatefulPropertiesService();
  try {
    runtime.saveUserApiToken("test-token-456");
    runtime.clearUserApiToken();
    const token = runtime.getUserApiToken();
    assert.ok(!token, "Expected empty/null token after clear, got: " + token);
  } finally {
    runtime.PropertiesService = originalProps;
  }
});

// ---------------------------------------------------------------------------
// context.js — email parsing
// ---------------------------------------------------------------------------

test("parseFromHeader extracts name and email from RFC 5322 header", () => {
  const result = toPlain(runtime.parseFromHeader("John Doe <john@example.com>"));
  assert.equal(result.name, "John Doe");
  assert.equal(result.email, "john@example.com");
});

test("parseFromHeader handles bare email address", () => {
  const result = toPlain(runtime.parseFromHeader("alice@example.com"));
  assert.equal(result.name, "");
  assert.equal(result.email, "alice@example.com");
});

test("extractEmailDomain returns domain from valid email", () => {
  assert.equal(runtime.extractEmailDomain("user@acme.com"), "acme.com");
});

test("isGenericEmailDomain returns true for gmail.com", () => {
  assert.equal(runtime.isGenericEmailDomain("gmail.com"), true);
});

test("isGenericEmailDomain returns false for acme.com", () => {
  assert.equal(runtime.isGenericEmailDomain("acme.com"), false);
});

// ---------------------------------------------------------------------------
// twenty_client.js — additional coverage
// ---------------------------------------------------------------------------

test("splitName splits two-part name into firstName and lastName", () => {
  assert.deepEqual(toPlain(runtime.splitName("John Doe")), {
    firstName: "John",
    lastName: "Doe"
  });
});

test("splitName handles single name with empty lastName", () => {
  assert.deepEqual(toPlain(runtime.splitName("Madonna")), {
    firstName: "Madonna",
    lastName: ""
  });
});

test("toUrl prepends https:// to bare domain", () => {
  assert.equal(runtime.toUrl("example.com"), "https://example.com");
});

test("toUrl preserves existing https:// protocol", () => {
  assert.equal(runtime.toUrl("https://example.com"), "https://example.com");
});

test("normalizeDomainValue strips protocol, www, path, and handles mailto prefix", () => {
  assert.equal(runtime.normalizeDomainValue("https://www.acme.com/path"), "acme.com");
  assert.equal(runtime.normalizeDomainValue("mailto:user@acme.com"), "acme.com");
  assert.equal(runtime.normalizeDomainValue("http://example.com:8080/page?q=1"), "example.com");
  assert.equal(runtime.normalizeDomainValue(""), "");
});

test("dedupeStrings removes duplicate strings case-insensitively", () => {
  const result = toPlain(runtime.dedupeStrings(["Foo", "foo", "Bar", "bar", "Baz"]));
  assert.deepEqual(result, ["Foo", "Bar", "Baz"]);
});

test("dedupeById removes duplicate objects by id", () => {
  const result = toPlain(
    runtime.dedupeById([
      { id: "a", name: "First" },
      { id: "b", name: "Second" },
      { id: "a", name: "Duplicate" }
    ])
  );
  assert.equal(result.length, 2);
  assert.equal(result[0].id, "a");
  assert.equal(result[0].name, "First");
  assert.equal(result[1].id, "b");
});

test("createNote happy path returns ok when both fetch calls succeed", () => {
  const getCallCount = mockFetchSequence([
    {
      statusCode: 201,
      body: { data: { createNote: { id: "note-ok" } } }
    },
    {
      statusCode: 201,
      body: { data: { createNoteTarget: { id: "nt-ok" } } }
    }
  ]);

  const result = toPlain(
    runtime.createNote(
      {
        title: "Test Note",
        body: "Some body",
        targetType: "person",
        targetId: "person-1"
      },
      "token"
    )
  );

  assert.equal(getCallCount(), 2);
  assert.equal(result.ok, true);
});

test("createActivity happy path returns ok when both fetch calls succeed", () => {
  const getCallCount = mockFetchSequence([
    {
      statusCode: 201,
      body: { data: { createTask: { id: "task-ok" } } }
    },
    {
      statusCode: 201,
      body: { data: { createTaskTarget: { id: "tt-ok" } } }
    }
  ]);

  const result = toPlain(
    runtime.createActivity(
      {
        title: "Test Activity",
        dueDate: "2026-04-01",
        body: "Body",
        targetType: "person",
        targetId: "person-1"
      },
      "token"
    )
  );

  assert.equal(getCallCount(), 2);
  assert.equal(result.ok, true);
});

test("sanitizeLogObject redacts apiToken and Authorization header", () => {
  const input = {
    apiToken: "secret-token",
    headers: { Authorization: "Bearer secret-token" },
    safe: "visible"
  };
  const result = toPlain(runtime.sanitizeLogObject(input));
  assert.equal(result.apiToken, "[REDACTED]");
  assert.equal(result.headers.Authorization, "Bearer [REDACTED]");
  assert.equal(result.safe, "visible");
});

// ---------------------------------------------------------------------------
// utils.js — additional coverage
// ---------------------------------------------------------------------------

test("normalizeDomainInput edge cases: empty string, bare domain, mailto prefix", () => {
  assert.equal(runtime.normalizeDomainInput(""), "");
  assert.equal(runtime.normalizeDomainInput("example.com"), "example.com");
  // normalizeDomainInput does not strip mailto: (only normalizeDomainValue does)
  // but it does strip http/https protocol and www
  assert.equal(runtime.normalizeDomainInput("https://www.test.org/path"), "test.org");
});
