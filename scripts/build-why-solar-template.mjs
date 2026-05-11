#!/usr/bin/env node
// Build the on-platform richtext version of the Why Solar Service Agreement
// and insert it as a template owned by the existing PDF template's owner.
//
// Usage:  node scripts/build-why-solar-template.mjs
// Requires: DATABASE_URL_UNPOOLED in .env.local

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Load .env.local explicitly (dotenv/config reads .env by default)
const envPath = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const OWNER_USER_ID = "c6caa011-d188-4130-b98d-a352ea3bf696"; // jos@profitgeeks.com.au
const OWNER_TEAM_ID = "c8cee28b-4e50-4651-a396-e2bb50da9e65";

// Recipient roles for the document
const CLIENT_ROLE_ID = randomUUID();
const WHY_SOLAR_ROLE_ID = randomUUID();

const recipientRoles = [
  { id: CLIENT_ROLE_ID, label: "Client", color: "#3b82f6" },
  { id: WHY_SOLAR_ROLE_ID, label: "Why Solar (Andrew McMaster)", color: "#f97316" },
];

// Single sender-fill variable: price per lead
const variableSchema = [
  { key: "price_per_lead", label: "Price per lead (ex GST)", type: "number" },
];

// --- Tiptap node helpers ----------------------------------------------------

const text = (t, marks) => (marks ? { type: "text", text: t, marks } : { type: "text", text: t });
const bold = (t) => text(t, [{ type: "bold" }]);
const italic = (t) => text(t, [{ type: "italic" }]);

const p = (...children) => ({ type: "paragraph", content: children.filter(Boolean) });
const h1 = (t) => ({ type: "heading", attrs: { level: 1 }, content: [text(t)] });
const h2 = (t) => ({ type: "heading", attrs: { level: 2 }, content: [text(t)] });
const h3 = (t) => ({ type: "heading", attrs: { level: 3 }, content: [text(t)] });
const li = (...children) => ({ type: "listItem", content: children });
const ul = (...items) => ({ type: "bulletList", content: items });
const ol = (...items) => ({ type: "orderedList", content: items });
const hr = () => ({ type: "horizontalRule" });
const quote = (...children) => ({ type: "blockquote", content: children });
const variable = (key, label) => ({
  type: "variable",
  attrs: { variableKey: key, label },
});
const field = ({ fieldType, recipientRoleId, label, required = true, options, placeholder }) => ({
  type: "signingField",
  attrs: {
    fieldKey: randomUUID(),
    fieldType,
    recipientRoleId,
    label,
    required,
    options: options ?? null,
    placeholder: placeholder ?? null,
  },
});

// Shortcut helpers for the Client signer
const clientField = (fieldType, label, opts = {}) =>
  field({ fieldType, recipientRoleId: CLIENT_ROLE_ID, label, ...opts });
const wsField = (fieldType, label, opts = {}) =>
  field({ fieldType, recipientRoleId: WHY_SOLAR_ROLE_ID, label, ...opts });

// --- Document content -------------------------------------------------------

const content = {
  type: "doc",
  content: [
    // === Cover / intro ===
    h1("Exclusive Solar Leads"),
    p(bold("Media Kit and Service Agreement — Why Solar | whysolar.com.au | 2026")),
    hr(),

    // === LEAD JOURNEY ===
    h2("Lead Journey"),
    ol(
      li(
        p(bold("1. Homeowner arrives on Why Solar")),
        p(text("Drawn by expert guides, calculators, rebate tools and organic search. They come to understand solar and battery storage — not to be sold to."))
      ),
      li(
        p(bold("2. Education and research")),
        p(text("Why Solar educates homeowners on system types, rebates, costs and what quality looks like. They use our free tools to model their own savings and payback period."))
      ),
      li(
        p(bold("3. Homeowner submits their details")),
        p(text("Only after engaging with the platform does the homeowner complete our form with their full details. This is their active signal of intent. Every field validated before delivery."))
      ),
      li(
        p(bold("4. Exclusively matched with you")),
        p(text("Unlike aggregators that send the same lead to multiple companies, Why Solar matches each homeowner with a single vetted installer. The lead is yours alone."))
      ),
      li(
        p(bold("5. Your team converts the lead")),
        p(text("You receive the lead in real time via CRM, Google Sheets or email. Your appointment setter calls, qualifies and books. The specialist closes."))
      ),
      li(
        p(bold("6. Ongoing account management")),
        p(text("Your Why Solar account manager works with you to monitor conversion rates, adjust campaign settings and maximise results."))
      )
    ),

    // === LEAD DATA POINTS ===
    h2("Lead Data Points"),
    p(text("Each delivered lead includes the following data:")),
    ul(
      li(p(text("First Name, Last Name, Email Address, Phone Number"))),
      li(p(text("Full Address and State"))),
      li(p(text("Homeowner Status (Y/N)"))),
      li(p(text("Power Bill Per Quarter"))),
      li(p(text("Existing Solar (Y/N)"))),
      li(p(text("Battery Interest (Y/N)")))
    ),

    // === STATS ===
    h2("Lead Conversion Statistics"),
    p(bold("30%"), text(" — Lead to appointment    •    "), bold("10%"), text(" — Lead to sale")),
    p(italic("Benchmarks based on historical averages across the client base. Actual results vary by team quality, market conditions and follow-up process.")),

    // === WHY WHY SOLAR ===
    h2("Why Why Solar"),
    h3("There are leads. And then there are Why Solar leads."),
    p(text("Why Solar is an independent solar education and installer matching platform. We have no financial relationship with panel brands, inverter manufacturers or energy retailers. We are not pushing a product. That independence is why educated homeowners trust us — they know the information they are getting is objective.")),
    p(text("By the time someone submits their details, they have already read our guides, used our calculators, explored their rebate options and made an active decision to move forward. Every lead has put their hand up. Your job is to convert that intent — not manufacture it.")),
    p(text("That exclusivity matters on the call. The homeowner is not fielding calls from three other companies. You have the full relationship. There is no race to the bottom on price before you have even spoken to them.")),

    h3("Our mission"),
    p(text("Our mission is to help good Australian solar installers grow their business while ensuring homeowners get quality systems that will still be performing in twenty years. Solar that ends up in landfill after five years is not a win for anyone. We are selective about who we work with because our reputation with homeowners depends on the quality of every install that follows.")),

    h3("Personalised delivery"),
    p(text("Every lead will be expecting a call directly from your business. Why Solar notifies the homeowner at the point of submission that a vetted installer will be in touch. You are not calling cold — you are the next step in a process they initiated.")),

    // === WILL YOU MAKE THE GRADE ===
    h2("Will You Make the Grade?"),
    p(text("Why Solar is selective about who joins the network. We only partner with installers who meet the following minimum criteria:")),
    ul(
      li(p(text("Holds a valid ABN and is registered for GST"))),
      li(p(text("Holds the appropriate contracting licence for their state"))),
      li(p(text("Has been operating in the Australian solar industry for at least 12 months"))),
      li(p(text("Sells reputable, quality hardware from established manufacturers"))),
      li(p(text("Provides a minimum 5-year workmanship warranty on all installations"))),
      li(p(text("Has at least one SAA-accredited designer as a full-time employee"))),
      li(p(text("Has a track record of satisfied customers and responsive post-install service"))),
      li(p(text("Will follow up all leads promptly and has internal systems for accountability"))),
      li(p(text("Provides comprehensive quotes including estimated yields and payback projections")))
    ),
    p(text("Why Solar reserves the right to remove any installer from the network who does not meet these standards or whose install quality, customer service or business conduct falls below expectations.")),

    hr(),

    // === LET'S GET STARTED ===
    h2("Let's get started!"),
    p(italic("Complete all sections below and return to hello@whysolar.com.au — or sign and submit electronically here.")),

    h3("Your Details"),
    p(bold("Company Name: "), clientField("company", "Company Name")),
    p(
      bold("First Name: "), clientField("firstname", "First Name"),
      text("    "),
      bold("Last Name: "), clientField("lastname", "Last Name")
    ),
    p(
      bold("Email: "), clientField("email", "Email Address"),
      text("    "),
      bold("Phone: "), clientField("phone", "Phone Number")
    ),
    p(bold("ABN: "), clientField("text", "ABN")),

    h3("Business Address"),
    p(bold("Street Address: "), clientField("address", "Street Address")),
    p(
      bold("Suite / Level: "), clientField("text", "Suite / Level", { required: false }),
      text("    "),
      bold("Suburb / City: "), clientField("suburb", "Suburb / City")
    ),
    p(
      bold("State: "), clientField("state", "State"),
      text("    "),
      bold("Postcode: "), clientField("postcode", "Postcode"),
      text("    "),
      bold("Country: "), clientField("text", "Country", { required: false, placeholder: "Australia" })
    ),

    h3("Campaign Setup"),
    p(bold("Region / State: "), clientField("state", "Campaign region")),
    p(bold("Monthly Cap: "), clientField("number", "Monthly cap (leads)")),
    p(bold("Postcodes: "), clientField("postcodes", "Postcodes (one per line, or attach file)")),

    h3("How would you like to receive leads?"),
    p(clientField("checkbox", "Google Sheets", { required: false }), text("  Google Sheets")),
    p(clientField("checkbox", "CRM", { required: false }), text("  CRM")),
    p(bold("CRM Name & API Key: "), clientField("custom", "CRM Name & API Key", { required: false })),
    p(bold("Email Address for Lead Notification: "), clientField("email", "Lead notification email")),

    h3("What days would you like to receive leads?"),
    p(
      clientField("checkbox", "Mon", { required: false }), text(" Mon  "),
      clientField("checkbox", "Tue", { required: false }), text(" Tue  "),
      clientField("checkbox", "Wed", { required: false }), text(" Wed  "),
      clientField("checkbox", "Thu", { required: false }), text(" Thu  "),
      clientField("checkbox", "Fri", { required: false }), text(" Fri  "),
      clientField("checkbox", "Sat", { required: false }), text(" Sat  "),
      clientField("checkbox", "Sun", { required: false }), text(" Sun")
    ),
    p(bold("Leads per day: "), clientField("number", "Leads per day")),
    p(
      bold("Lead Type: "),
      clientField("dropdown", "Lead Type", {
        options: ["Solar only", "Solar + Battery", "Both"],
      })
    ),

    h3("Accounts Department"),
    p(
      bold("Accounts Name: "), clientField("name", "Accounts Name"),
      text("    "),
      bold("Accounts Email: "), clientField("email", "Accounts Email")
    ),
    p(
      bold("Accounts Direct Line: "), clientField("phone", "Accounts Direct Line"),
      text("    "),
      bold("Normal Days to Make Payment: "), clientField("number", "Normal payment days")
    ),
    p(
      bold("Preferred Payment Method: "),
      clientField("dropdown", "Preferred Payment Method", {
        options: ["EFT", "Credit Card"],
      })
    ),

    hr(),

    // === SERVICE AGREEMENT ===
    h2("Service Agreement"),
    p(text("This Service Agreement (Agreement) is entered into between AM Marketing Group Pty Ltd (ACN 613 053 286) trading as Why Solar (ABN 37 613 053 286) (Service Provider) and the Client named in the Campaign Details section above. By proceeding with lead delivery, both parties agree to the terms set out in this Agreement.")),

    h3("1. Services"),
    p(text("Why Solar agrees to provide the Client with exclusive residential solar and solar + battery leads as described in this Agreement. Leads are delivered exclusively to the Client and are not shared with any other party. Why Solar only partners with SAA-accredited installers with a verified track record — this is a condition of participation in the network.")),

    h3("2. Compensation"),
    p(text("All prices are in Australian Dollars and exclude GST. GST applies to all invoiced amounts in accordance with Clause 17.")),
    p(bold("Price per lead (ex GST): $"), variable("price_per_lead", "Price per lead")),
    p(text("Why Solar may review pricing by providing 14 days written notice to the Client. If the Client does not accept the revised pricing, the Client may terminate this Agreement by written notice within that 14-day period without penalty and any prepaid, undelivered lead volume will be refunded or credited at the Client's election.")),

    h3("3. Payment Terms"),
    p(text("Payment is required in advance of each delivery week. Invoices are issued weekly for the following week's lead volume. Delivery pauses if payment is not received by the due date. Accepted methods: EFT bank transfer (preferred), credit card (2% surcharge applies). Payment terms: 7 days from invoice date unless otherwise agreed in writing.")),
    p(text("On termination of this Agreement for any reason, Why Solar will reconcile any prepaid, undelivered lead volume within 14 days and refund or credit the Client for leads paid for but not yet delivered, calculated on a per-lead basis at the agreed lead price.")),

    h3("4. Lead Definition and Replacement Policy"),
    p(text("A lead is defined as a record containing the data points set out in Clause 1, where the individual has actively submitted their details on whysolar.com.au and passed Why Solar's quality filtering and validation process. Delivery of a lead record meeting this definition constitutes fulfilment of Why Solar's obligations in respect of that lead.")),
    p(text("A credit or replacement lead will be issued only in the following circumstances:")),
    ul(
      li(p(text("Invalid or disconnected phone number — verified as non-functional on at least three dial attempts within 24 hours of delivery, with call logs provided as evidence"))),
      li(p(text("Lead confirmed as not a homeowner on first contact — supported by call notes"))),
      li(p(text("Duplicate lead — same name and address as a previously delivered lead within the same campaign")))
    ),
    p(text("Replacement requests must be submitted to the Client's account manager within 48 hours of lead delivery with supporting evidence. Why Solar has sole discretion to determine whether a replacement or credit is warranted. Leads that are contactable but do not convert are not eligible for replacement. To the maximum extent permitted by law, all implied warranties and conditions in relation to the leads are excluded.")),

    h3("5. Client Obligations"),
    p(text("The Client agrees to:")),
    ul(
      li(p(text("Employ or designate a dedicated appointment setter for lead follow-up"))),
      li(p(text("Attempt first contact within 5 minutes of lead delivery where operationally possible"))),
      li(p(text("Follow the recommended call cadence provided in the Why Solar onboarding pack"))),
      li(p(text("Hold and maintain current SAA (Solar Accreditation Australia) accreditation for at least one designer as a full-time employee throughout the term, and notify Why Solar immediately if accreditation lapses"))),
      li(p(text("Comply with the Australian Privacy Act 1988 (Cth), Spam Act 2003 (Cth) and Do Not Call Register Act 2006 (Cth) in all lead contact activities"))),
      li(p(text("Not on-sell, sub-license or share leads with third parties"))),
      li(p(text("Not use lead data for any purpose other than direct solar/battery sales follow-up")))
    ),

    h3("6. Term"),
    p(text("This Agreement commences on the date of first payment and continues on an ongoing rolling basis until terminated under Clause 7.")),

    h3("7. Termination"),
    p(text("Either party may terminate this Agreement by providing 14 days written notice by email.")),
    p(text("Why Solar may suspend or terminate immediately and without notice if the Client: (a) breaches any material term of this Agreement and fails to remedy that breach within 7 days of written notice; (b) fails to make payment when due; (c) loses or fails to renew SAA accreditation; (d) makes false or misleading representations in connection with solar or battery installations; (e) engages in conduct that Why Solar reasonably considers to be deceptive or misleading in its sales or installation practices; or (f) becomes insolvent, enters voluntary administration or has a receiver appointed.")),
    p(text("On immediate termination by Why Solar for cause under (b), any prepaid, undelivered leads will be forfeited. On immediate termination for any other reason, the prepaid reconciliation in Clause 3 applies.")),
    p(italic("Notices to Why Solar: hello@whysolar.com.au | 11 Bunduluk Place, Gunning NSW 2581")),

    h3("8. No Exclusivity"),
    p(text("This Agreement does not create geographic or market exclusivity. Why Solar may provide leads to multiple clients in the same geographic area. However, each individual lead is delivered to one client only and is not re-sold or shared.")),
    p(text("Geographic exclusivity for a defined postcode region may be made available by separate written agreement at Why Solar's discretion and subject to additional terms.")),

    h3("9. Independent Contractors"),
    p(text("The parties are independent contractors. Neither party is an agent, employee, partner or representative of the other.")),

    h3("10. No Guarantee of Results"),
    p(text("Why Solar does not guarantee any specific conversion rate, sale outcome or return on investment. Benchmarks stated in this Agreement are based on historical averages across the client base and will vary by team quality, market conditions and follow-up process.")),

    h3("11. Intellectual Property"),
    p(text("All advertising creative, targeting methodology, AI optimisation strategies, SEO and content assets, and lead generation systems used by Why Solar remain its exclusive intellectual property and are not disclosed to clients. Lead data delivered to the Client becomes the Client's data upon delivery.")),

    h3("12. Privacy and Compliance"),
    p(text("Both parties agree to handle all lead data in accordance with the Australian Privacy Act 1988 (Cth). The Client must not use lead data for any purpose other than direct follow-up in relation to the solar and battery services offered.")),
    p(text("The Client is solely responsible for ensuring all outbound contact activity complies with the Spam Act 2003 (Cth) and the Do Not Call Register Act 2006 (Cth). Why Solar accepts no liability for any enforcement action taken by the ACMA or any other regulatory body arising from the Client's contact or marketing activities. The Client indemnifies Why Solar against any claim, penalty or cost arising from the Client's failure to comply with these obligations.")),

    h3("13. Amendments"),
    p(text("This Agreement may be modified by written agreement between both parties. Pricing amendments are governed by Clause 2.")),

    h3("14. Dispute Resolution"),
    p(bold("a. Negotiation. "), text("Both parties agree to attempt resolution through good faith negotiation within 14 days of any dispute arising.")),
    p(bold("b. Mediation / Arbitration. "), text("If negotiation fails, either party may initiate mediation through LEADR or binding arbitration administered by the Australian Centre for International Commercial Arbitration (ACICA) under the ACICA Arbitration Rules current at the time of the dispute.")),
    p(bold("c. Governing Law. "), text("This Agreement is governed by the laws of New South Wales, Australia. Disputes not resolved by arbitration will be heard in the courts of New South Wales.")),
    p(bold("d. Legal Fees. "), text("The prevailing party may recover reasonable legal fees and costs.")),

    h3("15. Limitation of Liability"),
    p(text("To the maximum extent permitted by law, Why Solar's total aggregate liability to the Client under or in connection with this Agreement, whether in contract, tort (including negligence) or otherwise, is limited to the total amount paid by the Client to Why Solar in the three calendar months immediately preceding the event giving rise to the claim.")),
    p(text("Why Solar is not liable for any indirect, consequential, special or punitive loss or damage, including loss of profit, loss of revenue, loss of opportunity or loss of anticipated savings, whether or not such loss was foreseeable or Why Solar had been advised of its possibility.")),

    h3("16. Confidentiality"),
    p(text("Each party agrees to keep confidential all non-public information disclosed by the other party in connection with this Agreement, including pricing, campaign data, lead volumes and business methodology. Neither party will disclose such information to any third party without prior written consent, except as required by law or a regulatory authority.")),
    p(text("This obligation survives termination of this Agreement for a period of two years.")),

    h3("17. GST"),
    p(text("All consideration payable under this Agreement is exclusive of GST unless expressly stated otherwise. Where a party makes a taxable supply under this Agreement, the recipient must pay, in addition to the consideration for that supply, an amount equal to the GST payable on the supply. Why Solar will issue a valid tax invoice for each taxable supply. Both parties warrant they are registered for GST in Australia.")),

    h3("18. Force Majeure"),
    p(text("Neither party will be liable for any delay or failure to perform its obligations under this Agreement to the extent caused by circumstances beyond its reasonable control, including but not limited to changes to advertising platform policies, algorithm changes affecting lead volume, government regulation, natural disaster, pandemic or internet outage.")),
    p(text("If a force majeure event continues for more than 30 days, either party may terminate this Agreement on 7 days written notice without liability, and the prepaid reconciliation in Clause 3 will apply.")),

    h3("19. Entire Agreement"),
    p(text("This Agreement represents the full understanding between the parties and supersedes all prior written or verbal communications. Any variation must be agreed in writing.")),

    h3("20. Severability"),
    p(text("If any provision is found invalid or unenforceable, the remaining provisions continue in full force.")),

    hr(),

    // === LET'S SHAKE HANDS ===
    h2("Let's Shake Hands"),
    p(text("By signing below, both parties agree to the terms of this Agreement.")),

    h3("Client"),
    p(bold("Signed: "), clientField("signature", "Client signature")),
    p(bold("Name: "), clientField("name", "Client name")),
    p(bold("Title: "), clientField("title", "Client title")),
    p(bold("Date: "), clientField("date_auto", "Client signing date", { required: false })),

    h3("AM Marketing Group Pty Ltd trading as Why Solar"),
    p(bold("Signed: "), wsField("signature", "Why Solar signature")),
    p(bold("Name: "), italic("Andrew McMaster")),
    p(bold("Title: "), italic("Director")),
    p(bold("Date: "), wsField("date_auto", "Why Solar signing date", { required: false })),

    p(italic("AM Marketing Group Pty Ltd (ACN 613 053 286) trading as Why Solar  |  ABN 37 613 053 286  |  whysolar.com.au  |  hello@whysolar.com.au")),
  ],
};

// --- Insert ----------------------------------------------------------------

const url2 = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url2) {
  console.error("DATABASE_URL_UNPOOLED missing — check .env.local");
  process.exit(1);
}

const sql = neon(url2);

const fieldCount = (() => {
  let n = 0;
  const walk = (node) => {
    if (!node) return;
    if (node.type === "signingField") n++;
    if (Array.isArray(node.content)) for (const c of node.content) walk(c);
  };
  walk(content);
  return n;
})();

console.log(`Inserting template with ${fieldCount} inline fields...`);

const rows = await sql`
  INSERT INTO templates (user_id, team_id, name, description, content_type, content, recipient_roles, variable_schema)
  VALUES (
    ${OWNER_USER_ID},
    ${OWNER_TEAM_ID},
    'Why Solar Service Agreement (Richtext)',
    'On-platform composed version of the Why Solar Media Kit and Service Agreement.',
    'richtext',
    ${JSON.stringify(content)}::jsonb,
    ${JSON.stringify(recipientRoles)}::jsonb,
    ${JSON.stringify(variableSchema)}::jsonb
  )
  RETURNING id, name
`;

console.log(`✓ Created template: ${rows[0].id}`);
console.log(`  name: ${rows[0].name}`);
console.log(`  signers: ${recipientRoles.map((r) => r.label).join(", ")}`);
console.log(`  variables: ${variableSchema.map((v) => v.key).join(", ")}`);
console.log(`  fields: ${fieldCount}`);
