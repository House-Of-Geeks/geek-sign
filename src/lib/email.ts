import sgMail from "@sendgrid/mail";

// Initialize SendGrid - trim any whitespace/newlines from env vars
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY?.trim();
const FROM_EMAIL = (process.env.FROM_EMAIL || "noreply@houseofgeeks.com.au").trim();
const FROM_NAME = (process.env.FROM_NAME || "Geek Sign").trim();
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://sign.houseofgeeks.online";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
  if (!SENDGRID_API_KEY) {
    console.warn("SendGrid API key not configured. Email not sent:", { to, subject });
    return false;
  }

  try {
    console.log(`Attempting to send email to ${to} with subject: ${subject}`);
    console.log(`From: ${FROM_EMAIL} (${FROM_NAME})`);

    const response = await sgMail.send({
      to,
      from: {
        email: FROM_EMAIL,
        name: FROM_NAME,
      },
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ""),
    });

    console.log(`Email sent successfully to ${to}`, response);
    return true;
  } catch (error: unknown) {
    console.error("Failed to send email:", error);

    // Log detailed SendGrid error info
    if (error && typeof error === "object" && "response" in error) {
      const sgError = error as { response?: { body?: { errors?: Array<{ message?: string; field?: string }> } } };
      const errors = sgError.response?.body?.errors;
      if (errors && Array.isArray(errors)) {
        errors.forEach((err, i) => {
          console.error(`SendGrid error ${i + 1}: ${err.message} (field: ${err.field})`);
        });
      }
      console.error("SendGrid full error body:", JSON.stringify(sgError.response?.body, null, 2));
    }

    return false;
  }
}

// Custom branding options
export interface EmailBranding {
  logoUrl?: string | null;
  primaryColor?: string | null;
  companyName?: string | null;
}

// Email template wrapper with optional branding
function emailTemplate(content: string, branding?: EmailBranding): string {
  const headerColor = branding?.primaryColor || "#3b82f6";
  const brandName = branding?.companyName || "Geek Sign";
  const logoHtml = branding?.logoUrl
    ? `<img src="${branding.logoUrl}" alt="${brandName}" style="max-height: 40px; max-width: 200px;" />`
    : `<h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${brandName}</h1>`;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${brandName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
          <tr>
            <td align="center">
              <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <!-- Header -->
                <tr>
                  <td style="background-color: ${headerColor}; padding: 24px; text-align: center;">
                    ${logoHtml}
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 32px 24px;">
                    ${content}
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 24px; text-align: center; border-top: 1px solid #e5e7eb; background-color: #f9fafb;">
                    <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
                      Powered by <a href="${APP_URL}" style="color: ${headerColor}; text-decoration: none;">Geek Sign</a>
                    </p>
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      Free, secure e-signatures for everyone
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}

// Button component for emails
function emailButton(text: string, url: string, color: string = "#3b82f6"): string {
  return `
    <a href="${url}" style="display: inline-block; background-color: ${color}; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px; margin: 16px 0;">
      ${text}
    </a>
  `;
}

// ============================================
// SIGNER EMAILS
// ============================================

interface SignerInviteEmailProps {
  signerName: string | null;
  signerEmail: string;
  senderName: string;
  documentTitle: string;
  signUrl: string;
  message?: string;
  branding?: EmailBranding;
}

export async function sendSignerInviteEmail({
  signerName,
  signerEmail,
  senderName,
  documentTitle,
  signUrl,
  message,
  branding,
}: SignerInviteEmailProps): Promise<boolean> {
  const buttonColor = branding?.primaryColor || "#3b82f6";
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      You've been requested to sign a document
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi${signerName ? ` ${signerName}` : ""},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      <strong>${senderName}</strong> has requested your signature on the document:
    </p>
    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
    </div>
    ${message ? `
      <div style="border-left: 3px solid ${buttonColor}; padding-left: 16px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px; color: #6b7280; font-style: italic;">
          "${message}"
        </p>
      </div>
    ` : ""}
    <p style="margin: 0 0 8px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Click the button below to review and sign the document:
    </p>
    <div style="text-align: center;">
      ${emailButton("Review & Sign Document", signUrl, buttonColor)}
    </div>
    <p style="margin: 24px 0 0 0; font-size: 13px; color: #6b7280; line-height: 1.6;">
      Or copy and paste this link into your browser:<br>
      <a href="${signUrl}" style="color: ${buttonColor}; word-break: break-all;">${signUrl}</a>
    </p>
  `;

  return sendEmail({
    to: signerEmail,
    subject: `${senderName} requested your signature on "${documentTitle}"`,
    html: emailTemplate(content, branding),
  });
}

interface SignerReminderEmailProps {
  signerName: string | null;
  signerEmail: string;
  senderName: string;
  documentTitle: string;
  signUrl: string;
}

export async function sendSignerReminderEmail({
  signerName,
  signerEmail,
  senderName,
  documentTitle,
  signUrl,
}: SignerReminderEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      Reminder: Document awaiting your signature
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi${signerName ? ` ${signerName}` : ""},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      This is a friendly reminder that <strong>${senderName}</strong> is waiting for your signature on:
    </p>
    <div style="background-color: #fef3c7; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #f59e0b;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
    </div>
    <p style="margin: 0 0 8px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Please take a moment to review and sign the document:
    </p>
    <div style="text-align: center;">
      ${emailButton("Sign Document Now", signUrl, "#f59e0b")}
    </div>
  `;

  return sendEmail({
    to: signerEmail,
    subject: `Reminder: "${documentTitle}" is awaiting your signature`,
    html: emailTemplate(content),
  });
}

interface SignerCompletedEmailProps {
  signerName: string | null;
  signerEmail: string;
  documentTitle: string;
  downloadUrl?: string;
}

export async function sendSignerCompletedEmail({
  signerName,
  signerEmail,
  documentTitle,
  downloadUrl,
}: SignerCompletedEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      Thank you for signing!
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi${signerName ? ` ${signerName}` : ""},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      You have successfully signed the document:
    </p>
    <div style="background-color: #d1fae5; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #059669;">
        ✓ Signed successfully
      </p>
    </div>
    ${downloadUrl ? `
      <p style="margin: 0 0 8px 0; font-size: 15px; color: #374151; line-height: 1.6;">
        You can download a copy of the signed document below:
      </p>
      <div style="text-align: center;">
        ${emailButton("Download Document", downloadUrl, "#10b981")}
      </div>
    ` : `
      <p style="margin: 0; font-size: 15px; color: #374151; line-height: 1.6;">
        You will receive the final signed document once all parties have completed signing.
      </p>
    `}
  `;

  return sendEmail({
    to: signerEmail,
    subject: `You've signed "${documentTitle}"`,
    html: emailTemplate(content),
  });
}

// ============================================
// SENDER EMAILS
// ============================================

interface SenderDocumentSentEmailProps {
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  recipientCount: number;
  recipientEmails: string[];
  documentUrl: string;
}

export async function sendSenderDocumentSentEmail({
  senderName,
  senderEmail,
  documentTitle,
  recipientCount,
  recipientEmails,
  documentUrl,
}: SenderDocumentSentEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      Document sent for signing
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${senderName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Your document has been sent for signing:
    </p>
    <div style="background-color: #dbeafe; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #3b82f6;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #1d4ed8;">
        Sent to ${recipientCount} recipient${recipientCount > 1 ? "s" : ""}
      </p>
    </div>
    <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
      <strong>Recipients:</strong>
    </p>
    <ul style="margin: 0 0 16px 0; padding-left: 20px; color: #374151;">
      ${recipientEmails.map((email) => `<li style="margin: 4px 0;">${email}</li>`).join("")}
    </ul>
    <p style="margin: 0 0 8px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      You'll be notified as recipients view and sign the document.
    </p>
    <div style="text-align: center;">
      ${emailButton("View Document Status", documentUrl)}
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `"${documentTitle}" sent for signing`,
    html: emailTemplate(content),
  });
}

interface SenderDocumentViewedEmailProps {
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  viewerName: string | null;
  viewerEmail: string;
  documentUrl: string;
}

export async function sendSenderDocumentViewedEmail({
  senderName,
  senderEmail,
  documentTitle,
  viewerName,
  viewerEmail,
  documentUrl,
}: SenderDocumentViewedEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      Document viewed
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${senderName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      <strong>${viewerName || viewerEmail}</strong> has viewed your document:
    </p>
    <div style="background-color: #f3f4f6; padding: 16px; border-radius: 6px; margin: 16px 0;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
    </div>
    <div style="text-align: center;">
      ${emailButton("View Document Status", documentUrl)}
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `${viewerName || viewerEmail} viewed "${documentTitle}"`,
    html: emailTemplate(content),
  });
}

interface SenderDocumentSignedEmailProps {
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  signerName: string | null;
  signerEmail: string;
  remainingSigners: number;
  documentUrl: string;
}

export async function sendSenderDocumentSignedEmail({
  senderName,
  senderEmail,
  documentTitle,
  signerName,
  signerEmail,
  remainingSigners,
  documentUrl,
}: SenderDocumentSignedEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      Document signed!
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${senderName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      <strong>${signerName || signerEmail}</strong> has signed your document:
    </p>
    <div style="background-color: #d1fae5; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #059669;">
        ✓ Signed by ${signerName || signerEmail}
      </p>
    </div>
    ${remainingSigners > 0 ? `
      <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
        ${remainingSigners} signer${remainingSigners > 1 ? "s" : ""} remaining.
      </p>
    ` : ""}
    <div style="text-align: center;">
      ${emailButton("View Document Status", documentUrl)}
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `${signerName || signerEmail} signed "${documentTitle}"`,
    html: emailTemplate(content),
  });
}

interface SenderDocumentCompletedEmailProps {
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  documentUrl: string;
  downloadUrl?: string;
}

export async function sendSenderDocumentCompletedEmail({
  senderName,
  senderEmail,
  documentTitle,
  documentUrl,
  downloadUrl,
}: SenderDocumentCompletedEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      All signatures collected!
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${senderName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Great news! All parties have signed your document:
    </p>
    <div style="background-color: #d1fae5; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #059669;">
        ✓ Completed - All signatures collected
      </p>
    </div>
    <div style="text-align: center;">
      ${emailButton("View Completed Document", documentUrl)}
      ${downloadUrl ? `<br>${emailButton("Download Document", downloadUrl, "#10b981")}` : ""}
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `All signatures collected for "${documentTitle}"`,
    html: emailTemplate(content),
  });
}

interface SignerDocumentCompletedEmailProps {
  signerName: string | null;
  signerEmail: string;
  documentTitle: string;
  downloadUrl: string;
}

export async function sendSignerDocumentCompletedEmail({
  signerName,
  signerEmail,
  documentTitle,
  downloadUrl,
}: SignerDocumentCompletedEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #111827;">
      All signatures collected!
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi${signerName ? ` ${signerName}` : ""},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Great news — all parties have now signed the document below. Your fully executed copy is ready to download.
    </p>
    <div style="background-color: #d1fae5; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #10b981;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #059669;">
        ✓ Completed — all signatures collected
      </p>
    </div>
    <div style="text-align: center;">
      ${emailButton("Download Signed Document", downloadUrl, "#10b981")}
    </div>
  `;

  return sendEmail({
    to: signerEmail,
    subject: `All signatures collected — "${documentTitle}" is ready`,
    html: emailTemplate(content),
  });
}

interface SenderDocumentDeclinedEmailProps {
  senderName: string;
  senderEmail: string;
  documentTitle: string;
  declinerName: string | null;
  declinerEmail: string;
  reason?: string;
  documentUrl: string;
}

export async function sendSenderDocumentDeclinedEmail({
  senderName,
  senderEmail,
  documentTitle,
  declinerName,
  declinerEmail,
  reason,
  documentUrl,
}: SenderDocumentDeclinedEmailProps): Promise<boolean> {
  const content = `
    <h2 style="margin: 0 0 16px 0; font-size: 20px; color: #dc2626;">
      Document declined
    </h2>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      Hi ${senderName},
    </p>
    <p style="margin: 0 0 16px 0; font-size: 15px; color: #374151; line-height: 1.6;">
      <strong>${declinerName || declinerEmail}</strong> has declined to sign your document:
    </p>
    <div style="background-color: #fee2e2; padding: 16px; border-radius: 6px; margin: 16px 0; border-left: 4px solid #dc2626;">
      <p style="margin: 0; font-size: 16px; color: #111827; font-weight: 600;">
        ${documentTitle}
      </p>
      <p style="margin: 8px 0 0 0; font-size: 14px; color: #dc2626;">
        ✗ Declined by ${declinerName || declinerEmail}
      </p>
    </div>
    ${reason ? `
      <div style="border-left: 3px solid #dc2626; padding-left: 16px; margin: 16px 0;">
        <p style="margin: 0; font-size: 14px; color: #6b7280;">
          <strong>Reason:</strong> "${reason}"
        </p>
      </div>
    ` : ""}
    <div style="text-align: center;">
      ${emailButton("View Document", documentUrl)}
    </div>
  `;

  return sendEmail({
    to: senderEmail,
    subject: `${declinerName || declinerEmail} declined to sign "${documentTitle}"`,
    html: emailTemplate(content),
  });
}
