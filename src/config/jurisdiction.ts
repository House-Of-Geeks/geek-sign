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
    acknowledgements: string[];
    rights: { title: string; description: string }[];
    auditText: string;
    shortLabel: string;
  }
> = {
  AU: {
    label: "Australia",
    shortLabel: "Electronic Transactions Act 1999",
    consentTitle: "Electronic Signature Disclosure",
    consentIntro:
      "Under the Electronic Transactions Act 1999 (Cth) and equivalent state and territory legislation, an electronic signature is legally valid where it identifies the signatory, indicates their intention, and the method used is as reliable as appropriate for the purpose. By signing electronically, you are consenting to this method.",
    acknowledgements: [
      "Your electronic signature identifies you as the signatory and indicates your intention to be bound by this document.",
      "Your electronic signature has the same legal effect as a handwritten signature under Australian law.",
      "The signing method used is reliable and appropriate for the purpose of this document.",
      "You consent to conducting this transaction electronically.",
      "You have the ability to access, download, and retain a copy of this document.",
    ],
    rights: [
      {
        title: "Request a Paper Copy",
        description:
          "You may request a paper copy of this document from the sender at any time.",
      },
      {
        title: "Decline to Sign Electronically",
        description:
          "You are not required to sign electronically. Simply close this window if you do not wish to proceed, and contact the sender to arrange an alternative.",
      },
      {
        title: "Questions or Concerns",
        description:
          "If you have any questions about this document or the signing process, contact the sender before proceeding.",
      },
    ],
    auditText:
      "Compliant with Electronic Transactions Act 1999 (Cth) and applicable state legislation",
  },
  US: {
    label: "United States",
    shortLabel: "ESIGN Act & UETA",
    consentTitle: "ESIGN Act Disclosure",
    consentIntro:
      "In accordance with the Electronic Signatures in Global and National Commerce Act (ESIGN Act, 15 U.S.C. 7001 et seq.) and the Uniform Electronic Transactions Act (UETA), you are being asked to consent to the use of electronic signatures and electronic records.",
    acknowledgements: [
      "Your electronic signature has the same legal effect as a handwritten signature.",
      "You intend to sign this document electronically.",
      "You consent to receive documents and notices electronically.",
      "You have the ability to access and retain electronic records.",
    ],
    rights: [
      {
        title: "Right to Paper Copy",
        description:
          "You have the right to request a paper copy of any document. Contact the sender to request one.",
      },
      {
        title: "Right to Withdraw Consent",
        description:
          "You may withdraw your consent at any time by declining to sign. Simply close this window without signing.",
      },
      {
        title: "No Penalty",
        description:
          "There is no penalty for declining to sign electronically. You may request to sign via paper instead.",
      },
    ],
    auditText: "Compliant with ESIGN Act (15 U.S.C. 7001) and UETA",
  },
  OTHER: {
    label: "Other / International",
    shortLabel: "Applicable electronic signature laws",
    consentTitle: "Electronic Signature Disclosure",
    consentIntro:
      "In accordance with applicable electronic signature laws in your jurisdiction, you are being asked to consent to the use of electronic signatures and electronic records.",
    acknowledgements: [
      "Your electronic signature has the same legal effect as a handwritten signature.",
      "You intend to sign this document electronically.",
      "You consent to receive documents and notices electronically.",
      "You have the ability to access and retain electronic records.",
    ],
    rights: [
      {
        title: "Request a Paper Copy",
        description:
          "You may request a paper copy of this document from the sender at any time.",
      },
      {
        title: "Decline to Sign Electronically",
        description:
          "You are not required to sign electronically. Close this window if you wish to decline and contact the sender for alternatives.",
      },
    ],
    auditText: "Compliant with applicable electronic signature laws",
  },
};
