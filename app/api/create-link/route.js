export const runtime = "nodejs";

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import fs from "fs/promises";
import path from "path";

function safeTrim(v) {
  return typeof v === "string" ? v.trim() : "";
}

function money(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "0.00";
  return x.toFixed(2);
}

export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));

    const customerName = safeTrim(body.customerName);
    const customerNumber = safeTrim(body.customerNumber);

    const description = safeTrim(body.description) || "Ticket Purchase";
    const amountAed = Number(body.amountAed);
    const paymentUrl = safeTrim(body.paymentUrl);

    if (!Number.isFinite(amountAed) || amountAed <= 0) {
      return Response.json({ error: "amountAed must be > 0" }, { status: 400 });
    }

    // Create PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([595.28, 841.89]); // A4
    const { width, height } = page.getSize();

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Colors
    const gray = rgb(0.25, 0.25, 0.25);
    const lightGray = rgb(0.6, 0.6, 0.6);

    // Margins
    const margin = 40;

    // --- Logo (optional) ---
    // Put logo at /public/logo.png
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const logoBytes = await fs.readFile(logoPath);
      const logoImg = await pdfDoc.embedPng(logoBytes);

      const logoW = 55;
      const logoH = (logoImg.height / logoImg.width) * logoW;

      page.drawImage(logoImg, {
        x: margin,
        y: height - margin - logoH,
        width: logoW,
        height: logoH,
      });
    } catch {
      // If logo missing, continue without crashing
    }

    // --- Header titles ---
    page.drawText("AE Tickets", {
      x: margin + 70,
      y: height - margin - 15,
      size: 22,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    page.drawText("INVOICE", {
      x: width - margin - 110,
      y: height - margin - 15,
      size: 22,
      font: fontBold,
      color: gray,
    });

    // --- Top-left company info ---
    const leftInfoY = height - margin - 50;
    const leftLines = [
      "BAWABAT ALFAEALIAAT E-TRADE",
      "United Arab Emirates",
      "+971503638936",
    ];

    leftLines.forEach((t, i) => {
      page.drawText(t, {
        x: margin,
        y: leftInfoY - i * 14,
        size: 10.5,
        font,
        color: gray,
      });
    });

    // --- Top-right company info ---
    const rightInfoX = width - margin - 220;
    const rightInfoY = height - margin - 55;
    const rightLines = [
      "Web: www.aetickets.ae",
      "Country: United Arab Emirates",
      "Email: info@aetickets.ae",
    ];

    rightLines.forEach((t, i) => {
      page.drawText(t, {
        x: rightInfoX,
        y: rightInfoY - i * 14,
        size: 10.5,
        font,
        color: gray,
      });
    });

    // Divider line
    page.drawLine({
      start: { x: margin, y: height - 140 },
      end: { x: width - margin, y: height - 140 },
      thickness: 1,
      color: lightGray,
    });

    // --- Customer block ---
    let y = height - 170;

    page.drawText("Customer Details", {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    y -= 18;

    // Optional fields: only print if filled
    if (customerName) {
      page.drawText(`Customer Name: ${customerName}`, {
        x: margin,
        y,
        size: 11,
        font,
        color: gray,
      });
      y -= 16;
    }

    if (customerNumber) {
      page.drawText(`Customer Number: ${customerNumber}`, {
        x: margin,
        y,
        size: 11,
        font,
        color: gray,
      });
      y -= 16;
    }

    // Invoice meta on the right
    const today = new Date();
    const invoiceDate = `${String(today.getDate()).padStart(2, "0")}/${String(
      today.getMonth() + 1
    ).padStart(2, "0")}/${today.getFullYear()}`;

    page.drawText(`Invoice Date: ${invoiceDate}`, {
      x: width - margin - 170,
      y: height - 190,
      size: 11,
      font,
      color: gray,
    });

    page.drawText(`Status: PAID`, {
      x: width - margin - 170,
      y: height - 206,
      size: 11,
      font: fontBold,
      color: rgb(0, 0.5, 0),
    });

    // Divider line
    page.drawLine({
      start: { x: margin, y: y - 10 },
      end: { x: width - margin, y: y - 10 },
      thickness: 1,
      color: lightGray,
    });

    y -= 35;

    // --- Product table header ---
    const tableX = margin;
    const tableW = width - margin * 2;

    const colDesc = tableX;
    const colQty = tableX + tableW * 0.62;
    const colUnit = tableX + tableW * 0.72;
    const colTotal = tableX + tableW * 0.86;

    page.drawText("Description", { x: colDesc, y, size: 11, font: fontBold });
    page.drawText("Qty", { x: colQty, y, size: 11, font: fontBold });
    page.drawText("Unit Price", { x: colUnit, y, size: 11, font: fontBold });
    page.drawText("Total", { x: colTotal, y, size: 11, font: fontBold });

    y -= 10;

    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableW, y },
      thickness: 1,
      color: lightGray,
    });

    y -= 18;

    // --- Product row ---
    const qty = 1;
    const unitPrice = amountAed;
    const totalPrice = amountAed;

    page.drawText(description, { x: colDesc, y, size: 11, font, color: gray });
    page.drawText(String(qty), { x: colQty, y, size: 11, font, color: gray });
    page.drawText(money(unitPrice), { x: colUnit, y, size: 11, font, color: gray });
    page.drawText(money(totalPrice), { x: colTotal, y, size: 11, font, color: gray });

    y -= 26;

    page.drawLine({
      start: { x: tableX, y },
      end: { x: tableX + tableW, y },
      thickness: 1,
      color: lightGray,
    });

    y -= 24;

    // --- Totals block (right) ---
    const totalsX = width - margin - 180;

    page.drawText(`Subtotal: AED ${money(totalPrice)}`, {
      x: totalsX,
      y,
      size: 11,
      font,
      color: gray,
    });

    y -= 16;

    page.drawText(`Total: AED ${money(totalPrice)}`, {
      x: totalsX,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0, 0, 0),
    });

    y -= 22;

    page.drawText("Paid: YES", {
      x: totalsX,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0, 0.5, 0),
    });

    y -= 20;

    if (paymentUrl) {
      page.drawText("Payment Link:", {
        x: margin,
        y,
        size: 10.5,
        font: fontBold,
        color: gray,
      });
      y -= 14;

      // Wrap the link if long
      const linkText = paymentUrl.length > 95 ? paymentUrl.slice(0, 95) + "..." : paymentUrl;
      page.drawText(linkText, {
        x: margin,
        y,
        size: 10,
        font,
        color: rgb(0, 0, 0.7),
      });
    }

    // Output PDF
    const pdfBytes = await pdfDoc.save();

    return new Response(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="invoice.pdf"`,
      },
    });
  } catch (err) {
    return Response.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
