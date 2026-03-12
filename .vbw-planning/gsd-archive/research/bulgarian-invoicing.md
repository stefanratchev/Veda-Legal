# Research: Bulgarian Invoice Generation for a Small Law Firm

**Researched:** 2026-03-05
**Domain:** Legal invoicing in Bulgaria
**Overall Confidence:** MEDIUM-HIGH (legal requirements HIGH, inv.bg API details MEDIUM, alternatives MEDIUM)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Bulgarian Invoice Legal Requirements](#1-bulgarian-invoice-legal-requirements)
3. [inv.bg Platform & API](#2-invbg-platform--api)
4. [Alternative Bulgarian Invoicing Platforms](#3-alternative-bulgarian-invoicing-platforms)
5. [Self-Generation Option](#4-self-generation-option)
6. [Law Firm Specific Considerations](#5-law-firm-specific-considerations)
7. [Recommendation](#6-recommendation)
8. [Implementation Implications](#7-implementation-implications)
9. [Sources](#sources)

---

## Executive Summary

Bulgarian invoices (фактура) have strict legal requirements under Art.114 of the VAT Act (ЗДДС): 10-digit sequential numbering with no gaps, mandatory fields including both parties' VAT/EIK numbers, tax base in EUR (since Jan 2026 euro adoption), and issuance within 5 days of supply. Legal services are NOT VAT-exempt -- they are standard taxable supplies at 20% VAT.

**Critical context: Bulgaria adopted the euro on January 1, 2026.** All invoices must now be issued in EUR. The BGN is no longer the reporting currency. This significantly simplifies things for the firm since they already bill in EUR.

**Recommendation: Use inv.bg's REST API (v3)** for generating legally compliant invoices. It is the most popular Bulgarian invoicing platform, is NAP-approved, has a documented REST API, supports EUR, handles sequential numbering automatically, and costs EUR 8-28/month. Self-generation is legally possible but requires careful handling of sequential numbering, NAP reporting via monthly VAT registers, and upcoming SAF-T compliance -- complexity that inv.bg handles for you.

---

## 1. Bulgarian Invoice Legal Requirements

**Confidence: HIGH** (verified across multiple authoritative legal sources)

### 1.1 Mandatory Invoice Fields (Art.114 ЗДДС)

Every Bulgarian invoice (фактура) MUST contain:

| # | Field | Bulgarian Term | Notes |
|---|-------|---------------|-------|
| 1 | Document label "Invoice" | "Фактура" | Must appear prominently |
| 2 | Sequential 10-digit number | Пореден номер | Arabic numerals, no gaps, starting from 0000000001 |
| 3 | Date of issue | Дата на издаване | |
| 4 | Supplier name | Име на доставчика | Full legal name |
| 5 | Supplier address | Адрес на доставчика | Registered address |
| 6 | Supplier UIC/BULSTAT | ЕИК/БУЛСТАТ | Unified Identification Code |
| 7 | Supplier VAT number | ДДС номер | If VAT-registered (e.g., BG123456789) |
| 8 | Recipient name | Име на получателя | Full legal name |
| 9 | Recipient address | Адрес на получателя | |
| 10 | Recipient UIC/BULSTAT | ЕИК/БУЛСТАТ | |
| 11 | Recipient VAT number | ДДС номер | If applicable |
| 12 | Description of goods/services | Описание | Quantity, type, unit price |
| 13 | Date of taxable event | Дата на данъчно събитие | Or date of payment receipt |
| 14 | Tax base (net amount) | Данъчна основа | Amount excluding VAT |
| 15 | VAT rate | Ставка на ДДС | 20% standard, 9% reduced, 0% |
| 16 | VAT amount | Размер на ДДС | Calculated VAT |
| 17 | Total amount payable | Обща сума | Including VAT |
| 18 | Payment method | Начин на плащане | Cash or bank transfer (with bank details) |
| 19 | Name of invoice issuer | Име на съставителя | Person who prepared the invoice |

**NOT required since 2010:** Physical signature and stamp (removed to harmonize with EU VAT Directive).

### 1.2 Invoice Numbering Rules

- **10-digit format**: Must use Arabic numerals, starting from `0000000001`
- **Strictly sequential**: No gaps allowed. If numbers are skipped, the unused numbers must be formally cancelled (анулиране)
- **No backdating**: An invoice with a higher sequential number CANNOT have an earlier date than a previously issued invoice
- **Does NOT reset annually**: Numbering continues across calendar years
- **Multiple series allowed**: A company may use separate numbering series for different branches/departments, but each series must be independently sequential
- **Cancelled invoices**: Must still be recorded; cannot simply be deleted. Both parties must be notified.

### 1.3 Issuance Timeline

- Invoices must be issued **within 5 days** of the supply of goods/services OR receipt of payment (whichever comes first)
- Late issuance may result in fines and triggers NRA (НАП) inspection
- Missing the deadline means declaring VAT in a subsequent tax period

### 1.4 Document Types

| Type | Bulgarian | Purpose |
|------|-----------|---------|
| Invoice | Фактура | Primary billing document |
| Proforma Invoice | Проформа фактура | Pre-billing estimate (not a tax document) |
| Credit Note | Кредитно известие | Reduces a previously issued invoice |
| Debit Note | Дебитно известие | Increases a previously issued invoice |
| Protocol | Протокол | Used for reverse charge, self-billing |

### 1.5 Language & Currency (Post-Euro Adoption)

- **Primary language**: Bulgarian with Arabic numerals (required by the Accounting Act)
- **Foreign language**: Allowed alongside Bulgarian version, but Bulgarian copy must exist
- **Currency**: Since January 1, 2026, all invoices must be in **EUR** (Bulgaria adopted the euro)
- **Fixed rate**: Historical BGN amounts convert at 1 EUR = 1.95583 BGN
- **Dual display**: Required only for B2C receipts until Dec 31, 2026. NOT required for B2B invoices

### 1.6 Retention & Reporting

- **Retention**: Invoices must be stored for **10 years** (both issued and received)
- **Monthly VAT registers**: All VAT-registered entities must file monthly sales and purchase registers (дневници) to НАП
- **SAF-T reporting**: New requirement starting 2026 for large enterprises (>EUR 153M revenue). Small firms (~10 employees) will NOT be affected until **2029-2030** at the earliest
- **Electronic invoices**: Fully legal in Bulgaria. Sending PDF by email is accepted practice. No special e-invoicing format required for B2B (unlike B2G which requires EN 16931 format)

---

## 2. inv.bg Platform & API

**Confidence: MEDIUM** (platform features HIGH, API endpoint details MEDIUM -- Swagger UI is JS-rendered and couldn't be fully scraped)

### 2.1 Platform Overview

inv.bg is Bulgaria's most popular online invoicing platform:
- 100% web-based, no installation
- NAP-approved (одобрен от НАП)
- Compliant with Bulgarian tax law (ЗДДС, ЗЕДЕП, ЗСч, ЗКПО)
- NOT a СУПТРО system (not a fiscal device -- this is fine for services)
- Supports Bulgarian and English language invoices
- PDF generation and email delivery
- Electronic signature integration (B-Trust, InfoNotary, StampIt)
- iOS and Android mobile apps
- Import/Export with Microinvest, Azur, Business Navigator, Excel

### 2.2 Pricing Plans

| Plan | Price/month | Clients | Invoices/month | Users | API Access |
|------|------------|---------|----------------|-------|------------|
| Free | EUR 0 | 5 | 5 | 1 | No |
| Personal | EUR 4 | 15 | 15 | 1 | No |
| Small Business | EUR 8 | 150 | 150 | 10 | No |
| Business | EUR 28 | 1,000 | 1,000 | 25 | Yes (REST API) |
| Corporate | By negotiation | Unlimited | Unlimited | Unlimited | Yes (REST API) |

*Prices include VAT.*

**For the firm (~200 clients, ~10 employees):** The **Small Business plan (EUR 8/mo)** covers client/user limits but likely does NOT include API access. The **Business plan (EUR 28/mo)** or a **negotiated Corporate plan** would be needed for API integration.

### 2.3 REST API v3

**Base URL:** `https://api.inv.bg/v3/`

**Documentation:**
- Spec page: https://api.inv.bg/docs/en
- Swagger UI: https://api.inv.bg/v3/swagger-ui/
- Help articles: https://help.inv.bg/books/integratsiya-s-vnshni-sistemi

**What we know about the API:**

| Feature | Details |
|---------|---------|
| Protocol | REST (JSON) |
| Version | v3 |
| Authentication | Likely API key/token (Business+ plans) |
| Rate limits | Exist (documented in help articles, specific limits unknown) |
| Numbering via API | Supported -- can select numbering series |
| Invoice creation | Supported |
| Proforma creation | Supported |
| Client management | Supported |
| QR codes | Supported |
| PDF generation | Supported |
| Email delivery | Supported |

**IMPORTANT LIMITATION:** The API documentation is behind a JS-rendered Swagger UI that could not be fully scraped, and the OpenAPI JSON spec returns 401 (requires authentication). The full endpoint list, request/response schemas, and auth flow need to be verified by accessing the Swagger UI interactively or requesting docs from inv.bg.

### 2.4 What Needs Verification (Before Implementation)

1. **Authentication method**: Bearer token? API key header? OAuth?
2. **Exact endpoints**: POST /invoices? POST /documents?
3. **Request schema**: What fields can be set programmatically?
4. **Whether we can pass pre-calculated totals** or if inv.bg recalculates
5. **Credit/debit note creation** via API
6. **Webhook/callback support** for invoice status changes
7. **Rate limit specifics** (requests per minute/hour)

### 2.5 Integration Architecture (Proposed)

```
Veda Legal App                    inv.bg API v3
--------------                    -------------
ServiceDescription
  -> FINALIZED
  -> "Generate Invoice" button
  -> Map SD data to inv.bg format -> POST /invoices
  -> Store inv.bg invoice ID      <- Response: invoice ID, number
  -> Link SD to invoice
  -> Download PDF                 -> GET /invoices/{id}/pdf
  -> Track payment status         -> GET /invoices/{id}
```

---

## 3. Alternative Bulgarian Invoicing Platforms

**Confidence: MEDIUM**

### 3.1 Comparison Matrix

| Platform | API Type | API Maturity | Pricing | Best For |
|----------|----------|-------------|---------|----------|
| **inv.bg** | REST v3 | Production | EUR 8-28/mo | General invoicing, most popular |
| **Fakturirane.bg** | SOAP (XML) | Beta (v1.0) | Unknown | Legacy systems, PHP integrations |
| **Fakturirane.eu (Fakturnik)** | REST | Production | Requires "Cloud DB" license | Online stores, warehouse mgmt |
| **eFaktura.bg** | File-based (XML) | Production | Unknown | Enterprise, 8.5M+ invoices/year |
| **Microinvest Invoice Pro** | None (desktop) | N/A | One-time license | Desktop accounting |

### 3.2 Fakturirane.bg

- **API**: SOAP-based, beta v1.0
- **Authentication**: Username/password via SOAP header + EIK
- **Endpoint**: `https://fakturirane.bg/api/`
- **Function**: `api.create_document` with XML payload
- **Supports**: Invoice and proforma creation, email delivery
- **Drawback**: SOAP is antiquated for a Next.js app; beta quality; PHP-centric documentation

### 3.3 Fakturirane.eu (Fakturnik)

- **API**: REST-based
- **Authentication**: EIK + API key
- **Functions**: Create/edit/clone/search documents, PDF export, email delivery, client management, item management
- **Requirement**: Must purchase "Cloud Database" license with "API access" option
- **Better documented** than inv.bg in terms of function listing
- **Drawback**: Smaller market share, less community support

### 3.4 eFaktura.bg

- **Operated by**: BORICA AD (the national card payment processor)
- **Scale**: Largest e-invoicing platform in Bulgaria (8.5M+ invoices/year, 3000+ issuers)
- **API**: File-based XML upload via eFTools software
- **Focus**: Enterprise B2B e-invoicing with digital signatures
- **Drawback**: Overkill for a small firm; enterprise-oriented; not a simple REST API

### 3.5 Recommendation

**inv.bg is the best choice** because:
1. Most popular Bulgarian invoicing platform (large community, proven reliability)
2. NAP-approved
3. Modern REST API (v3) -- natural fit for a Next.js app
4. Handles sequential numbering, VAT calculations, and compliance automatically
5. Reasonable pricing (EUR 28/mo for API access)
6. Supports both Bulgarian and English invoices
7. Bilingual PDF generation built in

---

## 4. Self-Generation Option

**Confidence: HIGH** (legal feasibility well-documented)

### 4.1 Is It Legally Possible?

**YES.** There is no legal requirement in Bulgaria to use a specific invoicing platform. Any business can generate its own invoices as long as they contain all mandatory fields (see Section 1.1) and comply with numbering rules.

### 4.2 What You Would Need to Build

| Component | Complexity | Risk |
|-----------|-----------|------|
| PDF template with all mandatory fields | Low | Low -- we already have `@react-pdf/renderer` |
| Sequential 10-digit numbering system | Medium | **HIGH** -- gaps/duplicates violate tax law |
| Numbering series management (multiple series) | Medium | Medium |
| Invoice cancellation workflow | Medium | Medium |
| Credit/debit note generation | Medium | Low |
| Monthly VAT register export | High | **HIGH** -- must match НАП format exactly |
| Invoice storage for 10 years | Low | Low -- database + backups |
| Bilingual (BG + EN) invoices | Medium | Low |
| SAF-T export (future, ~2029) | High | Medium |

### 4.3 Sequential Numbering -- The Hard Problem

This is the highest-risk area of self-generation:

```
REQUIREMENTS:
- 10-digit, starting from 0000000001
- Strictly sequential, NO gaps
- Higher number cannot have earlier date
- Concurrent invoice creation must not create gaps
- Server crashes mid-generation must not lose numbers
- Cancelled invoices must retain the number (marked as cancelled)
```

**Implementation approach if self-generating:**
```typescript
// Use a PostgreSQL SEQUENCE for atomic number generation
// + a dedicated invoices table with a UNIQUE constraint on number
// + transaction to ensure the number is always used

// Schema addition:
// CREATE SEQUENCE invoice_number_seq START 1;
//
// In transaction:
//   1. nextval('invoice_number_seq') -> pad to 10 digits
//   2. INSERT invoice with that number
//   3. If anything fails, the sequence gap must be handled
//   4. PostgreSQL sequences don't roll back on transaction failure!
//      This means gaps CAN occur with sequences alone.

// BETTER APPROACH: Use a counter table with row-level locking
// BEGIN;
//   SELECT next_number FROM invoice_counters WHERE series = 'default' FOR UPDATE;
//   -- Use the number
//   UPDATE invoice_counters SET next_number = next_number + 1;
//   INSERT INTO invoices (...) VALUES (...);
// COMMIT;
```

**Key risk**: PostgreSQL `SEQUENCE` objects do NOT roll back on transaction failure, which means gaps can occur. A counter-table approach with `FOR UPDATE` locking is safer but creates a serialization bottleneck. For a small firm with ~200 invoices/month, this bottleneck is negligible, but the implementation must be bulletproof.

### 4.4 NAP Reporting Requirements

Invoices themselves do NOT need to be individually registered with НАП. However:

1. **Monthly VAT registers**: VAT-registered entities must file monthly purchase and sales registers to НАП. These registers must list every issued and received invoice. Filed via the НАП portal in TXT format.
2. **SAF-T (future)**: Starting ~2029 for small firms. Monthly XML submissions covering GL entries, invoices, payments, assets, and inventory. НАП has published XML schemas and validation tools.
3. **No real-time API**: НАП does not have a real-time invoice registration API. Reporting is monthly/periodic.

### 4.5 Self-Generation Verdict

| Aspect | Verdict |
|--------|---------|
| Legally possible? | Yes |
| Technically feasible? | Yes |
| Worth the effort? | **No, for this firm** |

**Rationale:** The firm has ~10 employees and ~200 clients. At EUR 28/month, inv.bg handles numbering compliance, VAT calculations, PDF generation in both languages, NAP-format exports, and upcoming SAF-T concerns. Building and maintaining this in-house would cost weeks of development time, ongoing compliance maintenance, and carry legal risk from bugs in the numbering system.

---

## 5. Law Firm Specific Considerations

**Confidence: HIGH** (VAT treatment verified across multiple sources)

### 5.1 VAT Treatment of Legal Services

**Legal services are NOT VAT-exempt in Bulgaria.** They are standard taxable supplies.

The VAT-exempt categories under ЗДДС Chapter IV (Art.39-46) are:
- Financial services
- Insurance services
- Healthcare
- Education
- Cultural activities
- Religious activities
- Real estate transactions

Attorney/legal services are **not in this list**. Therefore:
- If the firm is VAT-registered, invoices must include 20% VAT
- If below the EUR 51,130 threshold and not voluntarily registered, no VAT charged (but this is unlikely for a firm with ~200 clients)

### 5.2 VAT Registration

- **Threshold**: EUR 51,130 per calendar year (since Jan 2026)
- **Monitoring**: Daily cumulative basis within each calendar year
- **Registration deadline**: Within 7 days of exceeding the threshold
- **Effective date**: Day after the threshold is exceeded

A law firm with ~200 clients almost certainly exceeds this threshold and should already be VAT-registered.

### 5.3 EUR vs BGN -- Resolved by Euro Adoption

**This is no longer an issue.** Since January 1, 2026, Bulgaria's official currency is the euro. All invoices must be in EUR. The firm already bills in EUR, so this is perfectly aligned.

Historical context (pre-2026): Previously, invoices in foreign currency (EUR) required a BGN equivalent using the BNB exchange rate. This is no longer necessary.

### 5.4 Invoice Content for Legal Services

A typical law firm invoice should include:
- Standard mandatory fields (Section 1.1)
- Description of legal services provided (e.g., "Legal consultation on M&A advisory, January 2026")
- Hourly breakdown is common but not legally required -- the description of services is sufficient
- Payment terms and bank details

### 5.5 Service Description vs. Invoice

The current Veda Legal system generates "Service Descriptions" (описание на правни услуги) which are **not invoices**. They are detailed breakdowns of work performed. The typical workflow is:

```
1. Service Description (internal) -- detailed hours/tasks breakdown
2. Invoice (фактура) -- the legal tax document based on the SD totals
```

The service description can be attached to or referenced from the invoice, but the invoice itself must meet all the legal requirements in Section 1.1.

---

## 6. Recommendation

### Primary Approach: inv.bg API Integration

**Use inv.bg's REST API v3** to generate legally compliant Bulgarian invoices from finalized service descriptions.

**Flow:**
1. Partner/Admin finalizes a service description in Veda Legal
2. Clicks "Generate Invoice" button
3. System maps SD data to inv.bg API format:
   - Supplier: Firm details (from `firm-details.ts`, plus EIK, VAT number)
   - Client: Client name, address, EIK, VAT number (new fields needed on client model)
   - Line items: Can be detailed per-topic or summarized
   - Amount: Grand total from existing calculation functions
   - VAT: 20% on the net amount
4. API call creates invoice in inv.bg
5. inv.bg assigns sequential number, generates PDF
6. System stores inv.bg invoice ID and number, links to SD
7. PDF available for download/email from inv.bg

**Required schema additions (client model):**

```typescript
// New fields needed on the clients table:
eik: text(),           // ЕИК/БУЛСТАТ number (9 or 13 digits)
vatNumber: text(),     // VAT registration number (e.g., BG123456789)
legalAddress: text(),  // Registered legal address (for invoice)
```

**Required firm configuration (for inv.bg supplier details):**

```typescript
// Extend firm-details.ts:
export const firmDetails = {
  name: "VEDA LEGAL",
  fullName: "VEDA Legal Attorney Partnership",
  address: "47 Cherni Vrah Blvd.",
  city: "Sofia, Bulgaria",
  email: "hello@veda.legal",
  eik: "...",           // Firm's EIK/BULSTAT
  vatNumber: "BG...",   // Firm's VAT number
  bankName: "...",      // Bank for payment
  bankIban: "...",      // IBAN
  bankBic: "...",       // BIC/SWIFT
} as const;
```

### Fallback: Self-Generation

Only consider self-generation if:
- inv.bg API proves inadequate (missing features, unreliable)
- The firm wants full control over invoice appearance
- Cost becomes a concern (unlikely at EUR 28/mo)

If self-generating, use a counter-table approach for numbering (not PostgreSQL SEQUENCE) and have the firm's accountant verify compliance before going live.

---

## 7. Implementation Implications

### Phase Structure Suggestion

1. **Phase 1: Client Data Enhancement** -- Add EIK, VAT number, legal address fields to client model
2. **Phase 2: inv.bg API Integration** -- Account setup, API authentication, invoice creation endpoint
3. **Phase 3: Invoice Workflow** -- "Generate Invoice" button on finalized SDs, invoice list view, PDF download
4. **Phase 4: Invoice Management** -- Credit notes, cancellations, payment tracking

### Data Model Changes

New table: `invoices`
```
- id (text, PK)
- serviceDescriptionId (text, FK -> service_descriptions)
- externalId (text) -- inv.bg invoice ID
- invoiceNumber (text) -- the 10-digit number from inv.bg
- issueDate (date)
- taxableEventDate (date)
- netAmount (numeric)
- vatAmount (numeric)
- grossAmount (numeric)
- status (enum: ISSUED, CANCELLED, PAID)
- pdfUrl (text) -- cached/stored PDF
- createdAt, updatedAt
```

### Open Questions for the Firm

1. **Is the firm VAT-registered?** (Almost certainly yes, but must confirm)
2. **What is the firm's EIK/BULSTAT number?**
3. **Does the firm already have an inv.bg account?** (They use it manually -- confirm account tier)
4. **What numbering series do they currently use?** (Must continue from existing sequence)
5. **Do they need credit note generation** from the app?
6. **Do clients need to receive invoices by email** from the app, or is manual delivery acceptable initially?
7. **Does the accountant need any specific export format** for the monthly VAT registers?

---

## Sources

### Bulgarian Invoice Legal Requirements
- [Invoice Requirements in Bulgaria - Aidos Accountants](https://aidosbg.com/requirements-for-invoices-in-bulgaria/) -- HIGH confidence
- [Legal Requirements for an Invoice in Bulgaria - Ruskov & Kollegen](https://ruskov-law.eu/bulgaria/article/the-legal-requirements-for-an-invoice-in-bulgaria.html) -- HIGH confidence
- [Issuing Invoices: 5 Rules - Anagami.bg](https://www.anagami.bg/en/blog/issuing-invoices-from-bulgarian-based-company-5-rules-how-to-avoid-mistakes/) -- HIGH confidence
- [Guide to E-invoicing in Bulgaria - Storecove](https://www.storecove.com/blog/en/guide-to-e-invoicing-in-bulgaria/) -- MEDIUM confidence
- [Bulgarian VAT Invoice Requirements - Avalara](https://www.avalara.com/us/en/vatlive/country-guides/europe/bulgaria/bulgarian-vat-invoice-requirements.html) -- MEDIUM confidence

### Bulgaria Euro Adoption
- [Bulgaria's Euro Adoption Checklist - CE Interim](https://ceinterim.com/bulgarias-euro-adoption-checklist/) -- HIGH confidence
- [Bulgaria Euro Adoption 2026 - Aidos](https://aidosbg.com/bulgaria-euro-adoption-2026/) -- HIGH confidence
- [Bulgaria joins the euro area - ECB](https://www.ecb.europa.eu/euro/changeover/bulgaria/html/index.en.html) -- HIGH confidence

### VAT & Tax
- [VAT Changes in Bulgaria 2026 - Aidos](https://aidosbg.com/vat-changes-bulgaria-2026/) -- HIGH confidence
- [VAT-Exempt Supplies - Ruskov & Kollegen](https://ruskov-law.eu/sofia/article/neoblagaemi-dostavki-zdds.html) -- HIGH confidence (confirms legal services NOT exempt)
- [Bulgaria VAT Rates - Numeral](https://www.numeral.com/blog/bulgaria-vat-rates-and-compliance) -- MEDIUM confidence
- [Changes to Tax Law 2026 - Ruskov & Kollegen](https://ruskov-law.eu/bulgaria/article/changes-tax-law-bulgaria-2026.html) -- HIGH confidence

### SAF-T
- [Bulgaria SAF-T 2026 - EDICOM](https://edicomgroup.com/blog/bulgaria-electronic-invoice-saft-reporting) -- HIGH confidence
- [Bulgaria SAF-T - Taxually](https://www.taxually.com/blog/bulgaria-introduces-mandatory-saf-t-reporting-starting-2026) -- MEDIUM confidence
- [Bulgaria SAF-T - EY](https://www.ey.com/en_gl/technical/tax-alerts/bulgaria-officially-introduces-saf-t-with-submissions-beginning-in-2026) -- HIGH confidence

### inv.bg
- [inv.bg Homepage](https://inv.bg/) -- HIGH confidence (feature list, pricing)
- [inv.bg Plans](https://inv.bg/plans) -- HIGH confidence (pricing verified)
- [inv.bg Help Center](https://help.inv.bg/books) -- MEDIUM confidence (API section)
- [inv.bg API v3 Docs](https://api.inv.bg/docs/en) -- LOW confidence (could not scrape JS-rendered Swagger)
- [inv.bg API Swagger UI](https://api.inv.bg/v3/swagger-ui/) -- LOW confidence (could not scrape)

### Alternative Platforms
- [Fakturirane.bg API Documentation](https://www.fakturirane.bg/1/docs/docs/item/245-api-dokumentacija) -- MEDIUM confidence
- [Fakturirane.bg API Example - GitHub](https://github.com/KrestonBulmar/fakturirane-bg-api-connect-example) -- MEDIUM confidence
- [Fakturirane.eu API](https://fakturirane.eu/help/api/) -- MEDIUM confidence
- [eFaktura.bg](https://www.efaktura.bg/en) -- MEDIUM confidence
