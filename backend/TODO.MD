<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

## 🧱 Backend Excellence Checklist (Deep, Ranked, Copy-Paste Ready)

### 1️⃣ Core Architecture \& Code Quality

**Priority: HIGH**

- [ ] Layered architecture (routes → controllers → services → repositories → models)
- [ ] No business logic inside routes (controllers/services only)
- [ ] DTOs / validation schemas for every endpoint (e.g. Joi/Zod/Yup)
- [ ] Centralized config module (no `process.env` scattered)
- [ ] Feature-based folder structure (auth, students, coborrower, academic, etc.)
- [ ] Consistent error handling using `AppError` everywhere
- [ ] Async/await only, no raw promise chains in controllers
- [ ] No direct `console.log` in production (use logger)
- [ ] Strict ESLint + Prettier setup (CI-enforced)
- [ ] JS/TS doc comments on services and critical functions
- [ ] Enum-like constants for statuses (`"verified"`, `"processing"`, etc.)
- [ ] Central place for magic numbers (timeouts, limits, thresholds)
- [ ] Avoid circular dependencies between modules
- [ ] Request/response mappers (never expose raw DB documents directly)
- [ ] Versioned API (`/api/v1/...`) ready for future versions

---

### 2️⃣ Security \& Hardening

**Priority: CRITICAL**

- [ ] Helmet middleware (HSTS, XSS, clickjacking, etc.)
- [ ] Strict CORS config (allowed origins from env only)
- [ ] Rate limiting per IP + per user (login, PDF upload endpoints especially)
- [ ] Strong password hashing (bcrypt with salt, 10–12 rounds minimum)
- [ ] Refresh token + access token pattern (short-lived access tokens)
- [ ] JWT stored in HttpOnly cookies or secure headers, not in localStorage
- [ ] Token revocation / blacklist support (logout, password change, compromise)
- [ ] Enforce HTTPS (redirect HTTP → HTTPS at proxy level)
- [ ] Validate `Content-Type` headers (`application/json`, `multipart/form-data`)
- [ ] Reject unknown/extra fields in incoming JSON (whitelist allowed fields)
- [ ] Input sanitization for strings (XSS, SQL/NoSQL injection prevention)
- [ ] Strong validation for IDs (`ObjectId` check) before DB queries
- [ ] No secrets/API keys in code or logs (only in env/secret manager)
- [ ] Encrypt sensitive fields at rest (Aadhaar, PAN, phone, email if needed)
- [ ] Role-based access control middleware (admin, consultant, student, NBFC)
- [ ] Per-route authorization (e.g. student can only access own data)
- [ ] File upload allow-list (PDF only, block executable/MIME spoof)
- [ ] Virus scanning for uploads (ClamAV or service like Cloudmersive)
- [ ] Size limits on uploads (per-file + per-request)
- [ ] Secure Cloudinary usage (signed URLs where needed, least-privilege presets)
- [ ] Disable `X-Powered-By: Express` header
- [ ] Brute-force protection on login (lock account after X attempts)
- [ ] Audit log for critical actions (kyc change, financial verification, approvals)

---

### 3️⃣ Performance \& Scalability

**Priority: HIGH**

- [ ] Redis for caching frequently accessed data (student summaries, NBFC rules)
- [ ] Redis for sessions / rate-limits / queues
- [ ] Response caching middleware for read-heavy endpoints (status, analysis)
- [ ] MongoDB indexes on all query fields (student, coBorrower, kycStatus, etc.)
- [ ] Compound indexes for common filters (student + isDeleted, status + dates)
- [ ] Use `.lean()` for read-only queries to reduce Mongoose overhead
- [ ] Pagination + `limit` on all list endpoints (no unbounded `.find()`)
- [ ] Avoid `populate` in hot paths; use manual joins / projection when needed
- [ ] Connection pooling configured on MongoDB driver
- [ ] Avoid synchronous CPU-heavy operations in request cycle
- [ ] Offload heavy tasks (PDF parsing, AI calls) to background queues
- [ ] Use Bull/BullMQ with Redis for document processing \& notifications
- [ ] Separate worker process for AI/financial/academic processing
- [ ] Timeouts on all external HTTP calls (Python agent, third-party APIs)
- [ ] Circuit breaker pattern for Python agent (fallback behavior on failures)
- [ ] Compression (gzip/brotli) at reverse proxy level (Nginx)
- [ ] HTTP/1.1 keep-alive and proper timeouts on Node server
- [ ] CDN in front for static assets (if served by backend)
- [ ] Avoid sending huge JSON blobs (trim nested fields, paginate nested arrays)
- [ ] Use streaming for large responses if needed (logs, exports)
- [ ] Scheduled cleanup of temp upload files (already have `fileCleanup.js` → ensure cron)
- [ ] Structured indexing strategy review every release (analyze query patterns)

---

### 4️⃣ Reliability, Resilience \& Error Handling

**Priority: HIGH**

- [ ] Global `requestTimeout` middleware (already planned → ensure tuned per endpoint)
- [ ] Consistent use of `asyncHandler` in all controllers
- [ ] Unified error response format (`{ success:false, message, code }`)
- [ ] Map known external errors to user-friendly messages (Python agent, Cloudinary, DB)
- [ ] Retry with backoff for transient external errors (already in coBorrower financial → reuse helper)
- [ ] Graceful handling when AI agent is down (fallback status + user instructions)
- [ ] Health check route (`/health`) that checks DB, Redis, Python agent, Cloudinary
- [ ] Ready/Liveness endpoints for k8s/infra (`/health/ready`, `/health/live`)
- [ ] Validation errors return 400 with clear field-level messages
- [ ] Invariant checks in critical flows (e.g. KYC must be verified before financial upload)
- [ ] Idempotency keys for critical POSTs (loan request submission, payment webhooks)
- [ ] Graceful shutdown (close DB, Redis, server on SIGTERM/SIGINT)
- [ ] Fallback flows when partial data is present (e.g. financial partial analysis)
- [ ] Safe default values instead of `undefined` for optional nested fields
- [ ] Defensive coding around external data (Python response shape, missing fields)
- [ ] Custom 404 handler (`notFound`) + last error handler in server.js
- [ ] Proper logging of stack traces in error handler, but sanitized for clients

---

### 5️⃣ Logging, Monitoring \& Observability

**Priority: HIGH**

- [ ] Centralized logger (Winston/Pino) with log levels (debug, info, warn, error)
- [ ] Log correlation ID per request (trace ID stored in `req.id`)
- [ ] Logging middleware capturing method, path, status, duration, userId
- [ ] Separate transport for error logs (file/remote) vs info logs
- [ ] Sentry (or similar) integration for error tracking
- [ ] Alerting on high error rates (Slack/Discord/Telegram notifications)
- [ ] Application metrics (Prometheus-compatible):
  - [ ] Request count per route
  - [ ] Request latency percentiles
  - [ ] Error rate
  - [ ] Queue sizes (document processing)
  - [ ] External API latency/failures
- [ ] Health dashboard for Python AI latency and failures
- [ ] Slow query logger (DB ops > X ms)
- [ ] Log sampling in high-traffic routes to reduce noise
- [ ] Redact sensitive data from logs (tokens, Aadhaar, PAN, emails)

---

### 6️⃣ Data Integrity, Modeling \& Migrations

**Priority: HIGH**

- [ ] Schema-level validation on all Mongoose models (required, enums, min/max)
- [ ] Pre-save hooks for computed fields (summaries, normalized data)
- [ ] Versioning fields for critical documents (financialAnalysis, academic records)
- [ ] Soft delete pattern (`isDeleted`, `deletedAt`) used consistently
- [ ] Unique indexes where logical uniqueness is required (email, phone)
- [ ] References vs embedded docs chosen deliberately (analysis vs summary)
- [ ] Backfill/migration scripts for schema changes (Node scripts)
- [ ] Database backup schedule (daily incremental, weekly full)
- [ ] Restore testing from backup (disaster recovery drills)
- [ ] Seed scripts for dev/stage environments (mock students, NBFCs, loans)
- [ ] Data retention policies (how long to keep docs, logs, audit trails)
- [ ] Pseudonymization/anonymization for old records if required

---

### 7️⃣ Testing Strategy (Backend-Focused)

**Priority: HIGH**

- [ ] Unit tests (Jest) for:
  - [ ] Controllers (mock services)
  - [ ] Services (mock repositories)
  - [ ] Utility functions (FOIR, scoring, aggregations)
- [ ] Integration tests for:
  - [ ] Auth flows (register, login, refresh, logout)
  - [ ] Academic extraction + DB save flow
  - [ ] Financial upload → Python → DB → summary
  - [ ] KYC verification state transitions
- [ ] API contract tests (Postman/Newman or Pact) for core endpoints
- [ ] Load tests (Artillery/k6) for:
  - [ ] Financial upload
  - [ ] Academic complete extraction
  - [ ] Loan matching endpoints
- [ ] Resilience tests: Simulate Python agent down/slow, DB down, Redis down
- [ ] Mock external services (Cloudinary, Python AI, SMS/email) in tests
- [ ] Factory functions for generating test entities (students, coBorrowers)
- [ ] Test coverage thresholds in CI (e.g. 70%+ backend)
- [ ] Pre-commit hooks to run fast tests/lint (Husky)
- [ ] Test data isolated per test (in-memory Mongo or test DB)

---

### 8️⃣ File Handling \& Document Processing

**Priority: HIGH**

- [ ] Central MULTER config (disk storage, limits, allowed mimetypes)
- [ ] Consistent naming for file fields (`salary_slips_pdf`, `pdf_10th`, etc.)
- [ ] Temp file cleanup in `finally` blocks for all controllers (you already do this → ensure everywhere)
- [ ] Unified helper to call Python agents (you have one, reuse across modules)
- [ ] Strong validation of Python responses (shape + types) before saving to DB
- [ ] Track processing sessions (sessionId, timestamps, duration, status)
- [ ] Idempotency for repeated upload attempts (same docs reprocessed safely)
- [ ] Store only necessary extracted fields in summary objects
- [ ] Archive/rotate old Cloudinary documents (avoid indefinite growth)
- [ ] Enforce maximum number of stored documents per type per user (e.g. last 3 versions)

---

### 9️⃣ API Design \& DX (Developer Experience)

**Priority: MEDIUM**

- [ ] API documented with OpenAPI/Swagger (auto-generated preferably)
- [ ] Clear naming conventions for routes (`/financial/upload`, `/financial/status`)
- [ ] Consistent HTTP verbs and codes (GET/POST/PUT/PATCH/DELETE)
- [ ] Use 202 + polling for long-running operations (optional: WebSocket/SSE)
- [ ] Correlation ID in response headers (`X-Request-Id`) for debugging
- [ ] API versioning (`/api/v1/`) + deprecation strategy
- [ ] Example requests/responses in docs, especially for AI/financial endpoints
- [ ] Postman collection exported \& kept updated
- [ ] Dev env bootstrap script (seed + env example + basic data)
- [ ] Local dev profile (less strict limits, verbose logs)

---

### 🔟 Deployment \& Runtime (Backend Perspective)

**Priority: MEDIUM**

- [ ] Dockerfile optimized (multi-stage build, small runtime image)
- [ ] ENV-based config for all external services (no hard-coded URLs)
- [ ] PM2 ecosystem file with cluster mode \& auto-restart
- [ ] Graceful shutdown hooks (`server.close`, DB disconnect)
- [ ] Health check endpoint used by load balancer/orchestrator
- [ ] Separate environments: dev, staging, prod (different DBs \& services)
- [ ] Feature flags for experimental flows (new AI models, scoring logic)
- [ ] Rollback strategy (previous image version, DB migrations reversible)
- [ ] Logs shipped to central system (ELK/CloudWatch/etc.)
- [ ] Rate limiting tuned per environment (stricter in prod, looser in dev)

---

### 🔁 Backend-Specific “God Tier” Extras

**Priority: NICE-TO-HAVE**

- [ ] Domain events for major actions (e.g. `FINANCIAL_ANALYSIS_COMPLETED`)
- [ ] Event bus for inter-module communication (RabbitMQ/Kafka if scale demands)
- [ ] Feature toggles dashboard for non-devs (enable/disable flows)
- [ ] SLA/SLO definitions (e.g. 99.9% uptime, <300ms p95 for status APIs)
- [ ] Shadow deployments for new AI versions (compare outputs silently)
- [ ] Canary releases for risky changes (subsets of users)
