import { LegalDocumentType, LegalDocumentVersion, LegalConfigWarning } from '../types/legal';

/**
 * Authoritative system legal documents for MozBook.
 * Operating Company: Elvira da Gloria Consulting SU, Lda.
 * 
 * IMPORTANT: In compliance with Prompt 28A:
 * - Company registration details, NUIT, physical addresses, and licence numbers must not be fabricated.
 * - AI-generated documents are clearly flagged as requiring qualified Mozambican legal counsel review.
 * - Payment calculations (15% platform commission, 85% partner share) and PaySuite behaviors are faithfully represented.
 */

export const LEGAL_CONFIG_WARNINGS: LegalConfigWarning[] = [
  {
    field: 'companyRegistration',
    documentType: 'terms_customer',
    description: 'Commercial registry registration number, NUIT, and registered office address for Elvira da Gloria Consulting SU, Lda. are pending final corporate filings.',
    actionRequired: 'Provide verified NUIT and registered commercial address from company statutes.',
    requiresMozambicanLegalCounsel: true
  },
  {
    field: 'tourismLicensing',
    documentType: 'partner_agreement',
    description: 'Specific Mozambican Ministry of Culture and Tourism (INATUR) platform intermediation license number is pending statutory issuance.',
    actionRequired: 'Verify platform classification under Mozambican Tourism Regulations (Regulamento de Empreendimentos Turísticos e Agências de Viagens).',
    requiresMozambicanLegalCounsel: true
  },
  {
    field: 'consumerProtection',
    documentType: 'cancellation_refund_policy',
    description: 'Statutory cancellation cooling-off rights and dispute resolution under Mozambican Consumer Protection Law (Lei de Defesa do Consumidor).',
    actionRequired: 'Confirm local arbitration and consumer forum compatibility with qualified Mozambican counsel.',
    requiresMozambicanLegalCounsel: true
  },
  {
    field: 'dataProtection',
    documentType: 'privacy_policy',
    description: 'Cross-border data transfer disclosure for Google Cloud/Firebase processing locations outside Mozambique.',
    actionRequired: 'Confirm notification requirements under national data privacy frameworks.',
    requiresMozambicanLegalCounsel: true
  }
];

export const INITIAL_LEGAL_DOCUMENTS: Record<LegalDocumentType, LegalDocumentVersion> = {
  terms_customer: {
    id: 'terms_customer_v1',
    type: 'terms_customer',
    title: 'Customer Terms and Conditions',
    version: '1.0.0',
    contentHash: 'hash_terms_customer_1_0_0',
    status: 'published',
    effectiveDate: '2026-10-10',
    requiresLegalReview: true,
    legalCounselApproved: false,
    summaryOfChanges: 'Initial baseline customer agreement for MozBook platform operations in Mozambique.',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
    publishedAt: '2026-10-10T00:00:00Z',
    publishedBy: 'system',
    body: `
# MozBook Customer Terms and Conditions

**Operating Entity**: Elvira da Gloria Consulting SU, Lda. ("MozBook", "we", "our", or "us").  
**Platform**: MozBook (Web and Mobile Applications).  
**Effective Date**: October 10, 2026  
**Document Version**: 1.0.0  
**Legal Notice**: *This document reflects platform technical rules and business workflows. It requires formal ratification by qualified Mozambican legal counsel before serving as a final statutory deed.*

---

### 1. Platform Role & Scope of Services
1.1. MozBook is an online technology intermediary platform operated by Elvira da Gloria Consulting SU, Lda. MozBook connects travelers and customers ("Guests" or "Customers") with independent local third-party providers ("Operators" or "Partners") offering accommodation, activities, day tours, vehicle transport, and bespoke safari experiences across Mozambique.  
1.2. **Independence of Operators**: MozBook is not an accommodation owner, hoteliere, tour operator, guide, carrier, or transport provider unless explicitly stated in writing for a specific branded listing. All bookings made through MozBook constitute a direct bilateral service contract between the Customer and the respective Operator.  
1.3. **No Ownership of Listed Premises**: MozBook does not own, manage, inspect daily, or operate the properties, boats, vehicles, or equipment listed by independent Operators.

---

### 2. User Accounts & Acceptable Use
2.1. Customers must register an account using accurate, verified, and complete personal information.  
2.2. You are responsible for safeguarding your login credentials and notifying MozBook immediately of any unauthorized access.  
2.3. Prohibited conduct includes fraudulent bookings, creating speculative or fictitious reservations, attempting to circumvent platform payment systems, harassing hosts or other travelers, and transmitting malicious code.

---

### 3. Listings, Pricing, Availability & Currency
3.1. All prices on MozBook are displayed in Mozambican Meticais (MZN) unless a multi-currency display is toggled for informational estimates. Final checkout settlement is executed in Mozambican Meticais (MZN).  
3.2. Operators are solely responsible for the accuracy of their descriptions, amenities, photographs, and stated capacities.  
3.3. **Single-Payer Checkout & Travel Companion**: In group travel reservations coordinated via the MozBook Travel Companion feature, the primary booking contact acts as the designated single payer authorized to reserve and pay on behalf of all included group participants.

---

### 4. Reservation Holds, Payments & Confirmation
4.1. **15-Minute Inventory Hold**: Upon initiating checkout, MozBook places an atomic 15-minute temporary reservation hold on the selected stay unit, experience slot, or transport seat to prevent double booking.  
4.2. **Authoritative Payment Gateway**: All online financial transactions are processed securely through PaySuite, an authorized electronic payment provider regulated under the financial framework of the Republic of Mozambique. MozBook does not store complete card credentials or mobile money PINs.  
4.3. **Authoritative Confirmation**: A booking is legally confirmed **only** upon authoritative verification of payment settlement by PaySuite and automated creation of a confirmed booking token in the MozBook ledger. An in-flight or pending payment does not guarantee fulfillment until settled.

---

### 5. Cancellations, Operator Default & Alternative Services
5.1. Cancellations and refunds are governed strictly by the **MozBook Cancellation and Refund Policy**.  
5.2. **Alternative Arrangements in Inventory Failure**: In the rare technical event where payment is authoritatively confirmed but the underlying inventory cannot be fulfilled due to unforeseen operator default or technical concurrency, MozBook will:
  - Immediately alert the customer and provide suitable alternative dates or comparable services;
  - If the alternative is declined or unavailable, initiate an immediate 100% full refund through PaySuite without penalty.

---

### 6. Travel Companion & Privacy of Groups
6.1. The MozBook Travel Companion allows users to invite companions and coordinate itineraries. Private group details, member rosters, and individual passport details remain restricted strictly to authenticated group members and are never displayed publicly.

---

### 7. Limitation of Liability & Consumer Rights
7.1. To the maximum extent permitted by applicable Mozambican law (including Lei de Defesa do Consumidor), MozBook acts as an electronic intermediary and shall not be held liable for personal injury, property loss, delays, or physical damages resulting directly from the acts or omissions of independent Operators during an activity or stay.  
7.2. Nothing in these Terms limits or excludes consumer rights that cannot be lawfully waived or excluded under Mozambican legislation.

---

### 8. Governing Law & Dispute Resolution
8.1. These Terms are governed by and construed in accordance with the laws of the Republic of Mozambique.  
8.2. Parties shall first attempt amicable settlement through MozBook Customer Support. Any unresolved disputes are subject to the competent courts of Maputo, Republic of Mozambique, subject to confirmation by qualified Mozambican counsel.
`
  },

  cancellation_refund_policy: {
    id: 'cancellation_refund_policy_v1',
    type: 'cancellation_refund_policy',
    title: 'Cancellation and Refund Policy',
    version: '1.0.0',
    contentHash: 'hash_cancellation_refund_policy_1_0_0',
    status: 'published',
    effectiveDate: '2026-10-10',
    requiresLegalReview: true,
    legalCounselApproved: false,
    summaryOfChanges: 'Initial baseline cancellation, refund reconciliation, and operator inventory failure policy.',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
    publishedAt: '2026-10-10T00:00:00Z',
    publishedBy: 'system',
    body: `
# MozBook Cancellation and Refund Policy

**Operating Entity**: Elvira da Gloria Consulting SU, Lda.  
**Platform**: MozBook  
**Effective Date**: October 10, 2026  
**Document Version**: 1.0.0  
**Legal Notice**: *Reflects automated PaySuite financial ledger reconciliation and operator inventory accountability rules. Requires legal counsel confirmation for statutory notice periods.*

---

### 1. Overview & PaySuite Integration
1.1. MozBook executes all customer payments and refund disbursements via PaySuite, an authorized electronic payment service in Mozambique.  
1.2. **Authoritative Confirmation**: No refund is recorded as "completed" in MozBook merely because a request was submitted. A refund is completed **only** when PaySuite authoritatively confirms financial settlement and returns a valid reference ID.
1.3. **Third-Party Processing Fees**: PaySuite payment processing fees and banking network charges are separate transaction fees incurred upon electronic processing and are not refundable by default unless required by statutory consumer law.

---

### 2. Standardized Cancellation Policy Tiers
MozBook enforces immutable, versioned cancellation snapshots captured at checkout in the **Africa/Maputo (CAT / UTC+2)** timezone:

2.1. **Flexible Tier**:
  - Full (100%) refund if cancelled up to **24 hours prior** to official arrival/check-in time (14:00 CAT for accommodations; scheduled departure for experiences).
  - Cancellations within 24 hours of arrival are non-refundable (0% refund).

2.2. **Moderate Tier**:
  - Full (100%) refund if cancelled up to **5 days (120 hours)** prior to arrival time.
  - Cancellations within 5 days of arrival receive a 50% refund; the remaining 50% is retained.

2.3. **Strict Tier**:
  - Full (100%) refund if cancelled up to **14 days (336 hours)** prior to arrival time.
  - Cancellations made less than 14 days before arrival are non-refundable (0% refund).

2.4. **Non-Refundable Reservations**:
  - Reservations designated as non-refundable or booked under discounted non-refundable promotional rates receive a 0% refund upon cancellation or no-show.

2.5. **Weather-Dependent Maritime & Outdoor Safeguard**:
  - Outdoor activities, boat charters, and island safaris canceled due to hazardous weather conditions, cyclone alerts, or official INAM (National Institute of Meteorology) maritime bans entitle the traveler to free rescheduling or an authoritative **100% immediate full refund** via PaySuite without penalty to either party.

---

### 3. Service Failures, Operator Defaults & Accountability
3.1. **Operator Default & Failure to Deliver**:
  - If an Operator cancels a confirmed reservation without legitimate cause, or fails to deliver the reserved accommodation or experience, the Customer is entitled to a **100% full refund**.
  - The Operator incurs a **15% platform accountability debit** against their earnings ledger to compensate MozBook for administrative support and alternative rebooking costs.

3.2. **Operator Inventory Failure & Overbooking**:
  - Where a booking is paid but the Operator cannot honor the reservation due to overbooking, double-booking with external channels, or calendar neglect:
    - MozBook will propose an equivalent alternative where possible;
    - If declined, an immediate **100% full refund** is initiated;
    - The Operator is debited 15% under MozBook's Operator Inventory Accountability rules.

3.3. **Material Listing Inaccuracy**:
  - If accommodation or experiences differ materially from published descriptions (e.g., missing essential advertised facilities, misrepresented location, uninhabitable conditions), MozBook reserves the right to issue up to a 100% customer refund and charge back the provider.

3.4. **Customer No-Show**:
  - Failure to arrive without timely notice is treated as a 0% refund cancellation; retained amounts are distributed according to the standard 15% platform fee and 85% partner split.

---

### 4. Financial Reconciliation, Commission Split & Dispute Isolation
4.1. Standard MozBook bookings reflect a **15% platform commission** and an **85% partner net share**.  
4.2. When a cancellation occurs:
  - On the **Refunded Amount**: The 15% platform fee and 85% operator share are reversed proportionately in the ledger.
  - On the **Retained Amount**: MozBook earns 15% commission on the retained cancellation fee; the partner receives 85% net earnings.
4.3. **Dispute Isolation Safeguard**:
  - If a payment or booking is disputed (e.g., chargeback or formal quality complaint), the disputed transaction's funds are quarantined in the ledger.
  - Quarantined disputes do not freeze the partner's unrelated undisputed earnings, protecting normal weekly payout disbursements.
4.4. **Cumulative Refund Guard**: MozBook enforces strict server-side accounting ensuring that the cumulative sum of all partial refunds for a booking cannot exceed the original net settled payment amount.

---

### 5. Refund Processing Timelines & Inquiries
5.1. Mobile money refunds (M-Pesa, e-Mola) are generally credited within 24–48 business hours following PaySuite confirmation. Bank card reversals may take 5–10 business days depending on the issuing commercial bank in Mozambique.  
5.2. Inquiries regarding refund statuses can be directed to support@mozbook.co.mz with your Booking Reference number.
`
  },

  privacy_policy: {
    id: 'privacy_policy_v1',
    type: 'privacy_policy',
    title: 'Privacy and Data Protection Policy',
    version: '1.0.0',
    contentHash: 'hash_privacy_policy_1_0_0',
    status: 'published',
    effectiveDate: '2026-10-10',
    requiresLegalReview: true,
    legalCounselApproved: false,
    summaryOfChanges: 'Initial baseline privacy notice documenting actual Firebase, PaySuite, and KYC data flows.',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
    publishedAt: '2026-10-10T00:00:00Z',
    publishedBy: 'system',
    body: `
# MozBook Privacy Policy

**Operating Entity**: Elvira da Gloria Consulting SU, Lda.  
**Platform**: MozBook  
**Effective Date**: October 10, 2026  
**Document Version**: 1.0.0  
**Legal Notice**: *Details verified technical architecture (Google Cloud / Firebase, PaySuite) and post-booking KYC document handling. Requires counsel review regarding cross-border transfer filings.*

---

### 1. Information We Collect
1.1. **Account Information**: Full name, email address, telephone number, user role (guest, host, admin), and profile avatar.  
1.2. **Booking & Itinerary Data**: Travel dates, selected accommodations, activity participants, special requests, and single-payer transaction records.  
1.3. **Identity Verification (Host KYC)**:
  - Official national identity cards (B.I.), passports, DIRE, utility bills, business licenses (Alvará Comercial), and vehicle inspection certificates uploaded by hosts for regulatory verification.
  - **Storage & Security**: Host verification documents are stored securely with strict administrative access control. They are never published to guests or third parties.
1.4. **Device & Location Data**:
  - Approximate GPS coordinates for property location mapping and nearby emergency services, collected only upon user consent.
  - Browser/device metadata necessary for fraud prevention and session management.

---

### 2. How We Use Your Information
2.1. To process, confirm, and manage your accommodation and activity reservations.  
2.2. To securely communicate booking vouchers, confirmation tokens, and host contact details.  
2.3. To fulfill statutory compliance, tax accounting, and trust & safety verification of operators in Mozambique.  
2.4. To protect platform users against fraudulent transactions, double bookings, and account compromise.

---

### 3. Service Providers & Third-Party Processors
3.1. **PaySuite**: We transmit essential transaction details (booking reference, amount, customer phone/email) to PaySuite to process electronic payments. MozBook does not store full credit card numbers or mobile money credentials.  
3.2. **Google Cloud / Firebase**: User authentication, database records (Firestore), and encrypted asset storage are hosted on Google Cloud infrastructure.  
3.3. **Independent Operators**: When you complete a booking, your name and contact details are shared with the confirmed host or guide solely to deliver the reserved travel service.

---

### 4. Data Retention, Customer Rights & Deletion
4.1. Customers have the right to inspect their personal data, request corrections, or request account closure.  
4.2. Certain financial records, booking receipts, and host identity archives are retained for mandatory accounting and audit periods required under Mozambican commercial and tax laws.  
4.3. To exercise your privacy rights, contact our Data Officer at privacy@mozbook.co.mz.
`
  },

  partner_agreement: {
    id: 'partner_agreement_v1',
    type: 'partner_agreement',
    title: 'Partner and Operator Agreement',
    version: '1.0.0',
    contentHash: 'hash_partner_agreement_1_0_0',
    status: 'published',
    effectiveDate: '2026-10-10',
    requiresLegalReview: true,
    legalCounselApproved: false,
    summaryOfChanges: 'Initial baseline operator agreement covering listing accuracy, 15% commission, and inventory accountability.',
    createdAt: '2026-10-10T00:00:00Z',
    updatedAt: '2026-10-10T00:00:00Z',
    publishedAt: '2026-10-10T00:00:00Z',
    publishedBy: 'system',
    body: `
# MozBook Partner and Operator Agreement

**Operating Entity**: Elvira da Gloria Consulting SU, Lda. ("MozBook")  
**Target Parties**: Accommodations, Tour Operators, Activity Guides, and Transport Hosts ("Partners" or "Operators").  
**Effective Date**: October 10, 2026  
**Document Version**: 1.0.0  
**Legal Notice**: *Binding commercial terms governing platform listing, 15% commission, settlement, and inventory failure demerits. Subject to qualified Mozambican commercial legal counsel review.*

---

### 1. Onboarding, KYC Verification & Listing Activation
1.1. Partners must complete the MozBook Host Verification process by submitting verified corporate identification (Alvará, NUIT, or National B.I.), proof of physical operating address (utility bill), and applicable transport/maritime operating licenses.  
1.2. **Listing Activation**: No partner listing will be activated or visible to the public until this Agreement has been affirmatively accepted and identity verification has been reviewed and approved by MozBook operations.

---

### 2. Inventory Commitments & Overbooking Prohibition
2.1. Partners are strictly required to keep calendars, room allotments, and activity session capacities up to date in real time.  
2.2. **Prohibition on Unauthorized Reductions**: A Partner must never reduce allocated platform inventory below committed active reservations or active 15-minute checkout holds.  
2.3. Once a booking is authoritatively confirmed in the MozBook ledger, the Partner is legally obligated to honor and deliver the reserved service.

---

### 3. Financial Terms, Commission & Payouts
3.1. **Commission Model**: MozBook charges a **15% platform commission** on the gross value of all completed bookings. The Partner is entitled to the remaining **85% net partner share**.  
3.2. **Payout Schedule**: Net earnings are remitted to the Partner's verified Mozambican bank account or business mobile money wallet after customer check-in or successful activity commencement.  
3.3. **Taxes**: Partners are solely responsible for declaring their business income and remitting applicable Mozambican value-added tax (IVA) and corporate income taxes (IRPC/IRPS) to the Autoridade Tributária de Moçambique.

---

### 4. Operator Inventory Failure & Accountability Demerits
4.1. If an Operator fails to fulfill a confirmed booking due to unauthorized overbooking, unannounced closure, or negligence:
  - The customer is granted an immediate 100% refund;
  - The Operator's MozBook internal balance is debited the full booking amount;
  - The Operator incurs an accountability demerit record under the MozBook Operator Inventory Accountability framework.
4.2. **Fair Distinction**: Technical network errors, verified severe weather disruptions, or customer cancellations shall not be classified as Operator-caused inventory failures.  
4.3. Repeat inventory failures will result in immediate suspension or termination of partner listing privileges.

---

### 5. Standards of Service, Safety & Insurance
5.1. Operators providing adventure activities, maritime tours, or passenger transport must maintain appropriate commercial passenger liability insurance, seaworthiness certificates, and certified safety equipment (life jackets, first aid kits).  
5.2. Operators must adhere to high standards of hygiene, safety, and non-discrimination.
`
  }
};
