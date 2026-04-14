export type Jurisdiction = "AU" | "US" | "OTHER";

export const jurisdictions: { value: Jurisdiction; label: string }[] = [
  { value: "AU", label: "Australia" },
  { value: "US", label: "United States" },
  { value: "OTHER", label: "Other / International" },
];

export const jurisdictionConfig: Record<
  Jurisdiction,
  {
    label: string;
    consentTitle: string;
    consentIntro: string;
    auditText: string;
    shortLabel: string;
  }
> = {
  AU: {
    label: "Australia",
    shortLabel: "Electronic Transactions Act 1999",
    consentTitle: "Electronic Signature Disclosure",
    consentIntro:
      "In accordance with the Electronic Transactions Act 1999 (Cth) and applicable state and territory legislation, you are being asked to consent to the use of electronic signatures and electronic records.",
    auditText:
      "Compliant with Electronic Transactions Act 1999 (Cth) and applicable state legislation",
  },
  US: {
    label: "United States",
    shortLabel: "ESIGN Act & UETA",
    consentTitle: "ESIGN Act Disclosure",
    consentIntro:
      "In accordance with the Electronic Signatures in Global and National Commerce Act (ESIGN Act, 15 U.S.C. 7001 et seq.) and the Uniform Electronic Transactions Act (UETA), you are being asked to consent to the use of electronic signatures and electronic records.",
    auditText: "Compliant with ESIGN Act (15 U.S.C. 7001) and UETA",
  },
  OTHER: {
    label: "Other / International",
    shortLabel: "Applicable electronic signature laws",
    consentTitle: "Electronic Signature Disclosure",
    consentIntro:
      "In accordance with applicable electronic signature laws in your jurisdiction, you are being asked to consent to the use of electronic signatures and electronic records.",
    auditText: "Compliant with applicable electronic signature laws",
  },
};
