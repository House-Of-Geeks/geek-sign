import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { documents, recipients, documentFields, auditLogs, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jurisdictionConfig, type Jurisdiction } from "@/config/jurisdiction";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // Find the recipient by token
    const [recipient] = await db
      .select()
      .from(recipients)
      .where(eq(recipients.signingToken, token))
      .limit(1);

    if (!recipient) {
      return NextResponse.json({ error: "Invalid token" }, { status: 404 });
    }

    // Recipient must have signed to download
    if (recipient.status !== "signed") {
      return NextResponse.json(
        { error: "You must complete signing before downloading" },
        { status: 400 }
      );
    }

    // Get the document
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, recipient.documentId))
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Get all recipients and fields for this document
    const documentRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, document.id));

    // Check if ALL parties have signed (ESIGN Act compliance)
    const allSigned = documentRecipients.every((r) => r.status === "signed");
    if (!allSigned) {
      const pendingCount = documentRecipients.filter((r) => r.status !== "signed").length;
      return NextResponse.json(
        {
          error: "Document not yet complete",
          message: `Waiting for ${pendingCount} more ${pendingCount === 1 ? "party" : "parties"} to sign. You will receive the completed document via email once all parties have signed.`
        },
        { status: 400 }
      );
    }

    const fields = await db
      .select()
      .from(documentFields)
      .where(eq(documentFields.documentId, document.id));

    // Get document owner's jurisdiction
    const [documentOwner] = await db
      .select({ jurisdiction: users.jurisdiction })
      .from(users)
      .where(eq(users.id, document.userId))
      .limit(1);
    const jurisdiction = (documentOwner?.jurisdiction ?? "AU") as Jurisdiction;

    // Fetch the original PDF
    const pdfResponse = await fetch(document.fileUrl);
    if (!pdfResponse.ok) {
      return NextResponse.json(
        { error: "Failed to fetch original document" },
        { status: 500 }
      );
    }

    const pdfBytes = await pdfResponse.arrayBuffer();
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // PDF dimensions
    const getPageDimensions = (pageIndex: number) => {
      const page = pages[pageIndex];
      return {
        width: page.getWidth(),
        height: page.getHeight(),
      };
    };

    // Process each field and add to PDF
    for (const field of fields) {
      const pageIndex = (field.page || 1) - 1;
      if (pageIndex >= pages.length || pageIndex < 0) continue;

      const page = pages[pageIndex];
      const { height: pageHeight } = getPageDimensions(pageIndex);

      // Field positions are stored as pixel values, convert to PDF coordinates
      // The PDF coordinate system has origin at bottom-left
      const x = field.xPosition;
      const y = pageHeight - field.yPosition - field.height;
      const fieldWidth = field.width;
      const fieldHeight = field.height;

      const value = field.value || "";

      switch (field.type) {
        case "signature":
          if (value) {
            if (value.startsWith("data:image")) {
              try {
                const base64Data = value.split(",")[1];
                const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
                  c.charCodeAt(0)
                );

                let image;
                try {
                  image = await pdfDoc.embedPng(imageBytes);
                } catch {
                  try {
                    image = await pdfDoc.embedJpg(imageBytes);
                  } catch {
                    page.drawText(value, {
                      x: x + 5,
                      y: y + fieldHeight / 2 - 8,
                      size: 16,
                      font: helveticaFont,
                      color: rgb(0, 0, 0.5),
                    });
                    break;
                  }
                }

                const imgDims = image.scale(1);
                const scale = Math.min(
                  (fieldWidth - 10) / imgDims.width,
                  (fieldHeight - 10) / imgDims.height
                );

                page.drawImage(image, {
                  x: x + 5,
                  y: y + 5,
                  width: imgDims.width * scale,
                  height: imgDims.height * scale,
                });
              } catch (e) {
                console.error("Error embedding signature:", e);
                page.drawText(value, {
                  x: x + 5,
                  y: y + fieldHeight / 2 - 8,
                  size: 16,
                  font: helveticaFont,
                  color: rgb(0, 0, 0.5),
                });
              }
            } else {
              // Text-based signature - draw with cursive-like styling
              page.drawText(value, {
                x: x + 5,
                y: y + fieldHeight / 2 - 8,
                size: 16,
                font: helveticaFont,
                color: rgb(0, 0, 0.5),
              });
            }
          }
          break;

        case "initials":
          if (value) {
            if (value.startsWith("data:image")) {
              try {
                const base64Data = value.split(",")[1];
                const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
                  c.charCodeAt(0)
                );

                let image;
                try {
                  image = await pdfDoc.embedPng(imageBytes);
                } catch {
                  image = await pdfDoc.embedJpg(imageBytes);
                }

                const imgDims = image.scale(1);
                const scale = Math.min(
                  (fieldWidth - 4) / imgDims.width,
                  (fieldHeight - 4) / imgDims.height
                );

                page.drawImage(image, {
                  x: x + 2,
                  y: y + 2,
                  width: imgDims.width * scale,
                  height: imgDims.height * scale,
                });
              } catch {
                page.drawText(value, {
                  x: x + 5,
                  y: y + fieldHeight / 2 - 6,
                  size: 14,
                  font: helveticaBold,
                  color: rgb(0, 0, 0.5),
                });
              }
            } else {
              page.drawText(value, {
                x: x + 5,
                y: y + fieldHeight / 2 - 6,
                size: 14,
                font: helveticaBold,
                color: rgb(0, 0, 0.5),
              });
            }
          }
          break;

        case "date":
          if (value) {
            page.drawText(value, {
              x: x + 5,
              y: y + fieldHeight / 2 - 5,
              size: 10,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
          break;

        case "text":
        case "name":
        case "email":
        case "title":
        case "company":
        case "address":
          if (value) {
            page.drawText(value, {
              x: x + 5,
              y: y + fieldHeight / 2 - 5,
              size: 10,
              font: helveticaFont,
              color: rgb(0, 0, 0),
            });
          }
          break;

        case "checkbox":
          if (value === "true" || value === "checked") {
            page.drawText("X", {
              x: x + fieldWidth / 2 - 5,
              y: y + fieldHeight / 2 - 6,
              size: 14,
              font: helveticaBold,
              color: rgb(0, 0, 0),
            });
          }
          break;
      }
    }

    // Add signature certificate page
    const auditPage = pdfDoc.addPage();
    const { width: auditWidth, height: auditHeight } = auditPage.getSize();

    // Get audit logs for this document
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.documentId, document.id))
      .orderBy(auditLogs.createdAt);

    // Draw certificate
    let yPos = auditHeight - 50;

    auditPage.drawText("SIGNING CERTIFICATE", {
      x: 50,
      y: yPos,
      size: 18,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    yPos -= 30;
    auditPage.drawText(`Document: ${document.title}`, {
      x: 50,
      y: yPos,
      size: 12,
      font: helveticaFont,
      color: rgb(0, 0, 0),
    });

    yPos -= 20;
    auditPage.drawText(`Document ID: ${document.id}`, {
      x: 50,
      y: yPos,
      size: 10,
      font: helveticaFont,
      color: rgb(0.4, 0.4, 0.4),
    });

    yPos -= 40;
    auditPage.drawText("SIGNERS", {
      x: 50,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    yPos -= 20;
    for (const r of documentRecipients) {
      const status = r.status === "signed" ? "Signed" : "Pending";
      auditPage.drawText(
        `${r.name || r.email} <${r.email}> - ${status}`,
        {
          x: 50,
          y: yPos,
          size: 10,
          font: helveticaFont,
          color: rgb(0, 0, 0),
        }
      );
      yPos -= 15;
      if (r.status === "signed" && r.signedAt) {
        auditPage.drawText(
          `   Signed: ${r.signedAt.toISOString()}`,
          {
            x: 50,
            y: yPos,
            size: 9,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
          }
        );
        yPos -= 25;
      } else {
        yPos -= 10;
      }
    }

    // Note about document status (all parties have signed at this point)
    yPos -= 20;
    auditPage.drawText(
      "Status: All parties have signed - Document Complete",
      {
        x: 50,
        y: yPos,
        size: 11,
        font: helveticaBold,
        color: rgb(0, 0.5, 0),
      }
    );

    // Footer
    auditPage.drawText(
      "This document was signed electronically using Geek Sign (sign.houseofgeeks.online)",
      {
        x: 50,
        y: 30,
        size: 8,
        font: helveticaFont,
        color: rgb(0.5, 0.5, 0.5),
      }
    );

    auditPage.drawText(jurisdictionConfig[jurisdiction].auditText, {
      x: 50,
      y: 20,
      size: 8,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Save the PDF
    const signedPdfBytes = await pdfDoc.save();

    // Log the download
    await db.insert(auditLogs).values({
      documentId: document.id,
      recipientId: recipient.id,
      action: "document_downloaded",
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "unknown",
      details: {
        downloadedBy: recipient.email,
        downloadedAt: new Date().toISOString(),
      },
    });

    // Return the PDF
    return new NextResponse(Buffer.from(signedPdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${document.title}-signed.pdf"`,
        "Content-Length": signedPdfBytes.length.toString(),
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed document" },
      { status: 500 }
    );
  }
}
