import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { documents, recipients, documentFields, auditLogs, users } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { jurisdictionConfig, type Jurisdiction } from "@/config/jurisdiction";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the document
    const [document] = await db
      .select()
      .from(documents)
      .where(
        and(eq(documents.id, id), eq(documents.userId, session.user.id))
      )
      .limit(1);

    if (!document) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    // Check if document is completed
    if (document.status !== "completed") {
      return NextResponse.json(
        { error: "Document is not fully signed yet" },
        { status: 400 }
      );
    }

    // Get all recipients and fields
    const documentRecipients = await db
      .select()
      .from(recipients)
      .where(eq(recipients.documentId, id));

    const fields = await db
      .select()
      .from(documentFields)
      .where(eq(documentFields.documentId, id));

    // Get document owner's jurisdiction
    const [documentOwner] = await db
      .select({ jurisdiction: users.jurisdiction })
      .from(users)
      .where(eq(users.id, session.user.id))
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

    // PDF dimensions (standard letter size - need to get actual page size)
    const getPageDimensions = (pageIndex: number) => {
      const page = pages[pageIndex];
      return {
        width: page.getWidth(),
        height: page.getHeight(),
      };
    };

    // Debug: Log field info
    console.log("Download: Processing", fields.length, "fields");
    for (const f of fields) {
      console.log("Field:", f.id, "type:", f.type, "page:", f.page, "value:", f.value ? "has value" : "NO VALUE", "pos:", f.xPosition, f.yPosition);
    }

    // Process each field and add to PDF
    for (const field of fields) {
      const pageIndex = (field.page || 1) - 1;
      if (pageIndex >= pages.length || pageIndex < 0) continue;

      const page = pages[pageIndex];
      const { width: pageWidth, height: pageHeight } = getPageDimensions(pageIndex);

      // Field positions are stored as pixel values from react-pdf at scale=1
      // PDF coordinate system has origin at bottom-left
      const x = field.xPosition;
      const y = pageHeight - field.yPosition - field.height;
      const fieldWidth = field.width;
      const fieldHeight = field.height;

      console.log("Rendering field at PDF coords: x=", x, "y=", y, "pageHeight=", pageHeight, "pageWidth=", pageWidth);

      const value = field.value || "";
      const recipient = documentRecipients.find((r) => r.id === field.recipientId);

      switch (field.type) {
        case "signature":
          if (value) {
            // Draw signature image if it's a data URL
            if (value.startsWith("data:image")) {
              try {
                const base64Data = value.split(",")[1];
                const imageBytes = Uint8Array.from(atob(base64Data), (c) =>
                  c.charCodeAt(0)
                );

                // Try PNG first, then JPEG
                let image;
                try {
                  image = await pdfDoc.embedPng(imageBytes);
                } catch {
                  try {
                    image = await pdfDoc.embedJpg(imageBytes);
                  } catch {
                    // If both fail, draw text placeholder
                    page.drawText("[Signature]", {
                      x: x + 5,
                      y: y + fieldHeight / 2 - 6,
                      size: 12,
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
                page.drawText("[Signature]", {
                  x: x + 5,
                  y: y + fieldHeight / 2 - 6,
                  size: 12,
                  font: helveticaFont,
                  color: rgb(0, 0, 0.5),
                });
              }
            } else {
              // Text-based signature
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
            // Draw a checkmark
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

    // Add audit trail/certificate page
    const auditPage = pdfDoc.addPage();
    const { width: auditWidth, height: auditHeight } = auditPage.getSize();

    // Get audit logs
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.documentId, id))
      .orderBy(auditLogs.createdAt);

    // Draw audit certificate
    let yPos = auditHeight - 50;

    auditPage.drawText("CERTIFICATE OF COMPLETION", {
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

    yPos -= 20;
    auditPage.drawText(
      `Completed: ${document.completedAt?.toISOString() || "N/A"}`,
      {
        x: 50,
        y: yPos,
        size: 10,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      }
    );

    yPos -= 40;
    auditPage.drawText("SIGNERS", {
      x: 50,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    yPos -= 20;
    for (const recipient of documentRecipients) {
      if (recipient.status === "signed") {
        auditPage.drawText(
          `${recipient.name || recipient.email} <${recipient.email}>`,
          {
            x: 50,
            y: yPos,
            size: 10,
            font: helveticaFont,
            color: rgb(0, 0, 0),
          }
        );
        yPos -= 15;
        auditPage.drawText(
          `   Signed: ${recipient.signedAt?.toISOString() || "N/A"}`,
          {
            x: 50,
            y: yPos,
            size: 9,
            font: helveticaFont,
            color: rgb(0.4, 0.4, 0.4),
          }
        );
        yPos -= 15;
        auditPage.drawText(`   IP: ${recipient.ipAddress || "N/A"}`, {
          x: 50,
          y: yPos,
          size: 9,
          font: helveticaFont,
          color: rgb(0.4, 0.4, 0.4),
        });
        yPos -= 25;
      }
    }

    yPos -= 20;
    auditPage.drawText("AUDIT TRAIL", {
      x: 50,
      y: yPos,
      size: 14,
      font: helveticaBold,
      color: rgb(0, 0, 0),
    });

    yPos -= 20;
    for (const log of logs) {
      if (yPos < 50) break; // Stop if we run out of space

      const timestamp = log.createdAt.toISOString();
      const action = log.action.replace(/_/g, " ").toUpperCase();

      auditPage.drawText(`${timestamp}`, {
        x: 50,
        y: yPos,
        size: 8,
        font: helveticaFont,
        color: rgb(0.4, 0.4, 0.4),
      });

      auditPage.drawText(action, {
        x: 200,
        y: yPos,
        size: 9,
        font: helveticaFont,
        color: rgb(0, 0, 0),
      });

      if (log.ipAddress) {
        auditPage.drawText(`IP: ${log.ipAddress}`, {
          x: 400,
          y: yPos,
          size: 8,
          font: helveticaFont,
          color: rgb(0.4, 0.4, 0.4),
        });
      }

      yPos -= 15;
    }

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
      documentId: id,
      action: "document_downloaded",
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ||
        request.headers.get("x-real-ip") ||
        "unknown",
      details: {
        downloadedBy: session.user.email,
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
