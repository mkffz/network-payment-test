"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("idle");

  const linkInputRef = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────

  async function tryAutoCopy(text) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  function selectLink() {
    const el = linkInputRef.current;
    if (!el) return;
    el.focus();
    el.select();
    el.setSelectionRange(0, el.value.length);
  }

  async function tapToCopy() {
    if (!link) return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        selectLink();
        document.execCommand("copy");
      }
      setCopyStatus("success");
    } catch {
      selectLink();
      document.execCommand("copy");
      setCopyStatus("success");
    }
  }

  // Fetch an image from /public and return a base64 data URL
  async function imageUrlToBase64(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ── Generate Payment Link ────────────────────────────────────────────────

  async function generate() {
    setError("");
    setLink("");
    setCopyStatus("idle");

    const enteredAmount = Number(amount);
    if (!description.trim()) return setError("Please enter a description.");
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0)
      return setError("Please enter a valid amount > 0.");

    const apiAmount = Math.round(enteredAmount * 100);
    setLoading(true);
    try {
      const res = await fetch("/api/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: description.trim(), amount: apiAmount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");

      setLink(data.paymentUrl);
      const ok = await tryAutoCopy(data.paymentUrl);
      setTimeout(() => selectLink(), 50);
      setCopyStatus(ok ? "success" : "failed");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  // ── Generate Invoice PDF ─────────────────────────────────────────────────

  async function generateInvoicePDF() {
    const enteredAmount = Number(amount);
    if (!description.trim()) return setError("Please enter a description.");
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0)
      return setError("Please enter a valid amount > 0.");

    setError("");
    setPdfLoading(true);

    try {
      const pdfMake = (await import("pdfmake/build/pdfmake")).default;
      const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default;
      pdfMake.vfs = pdfFonts.vfs;

      // Load the invoice template PNG from /public folder
      const templateBase64 = await imageUrlToBase64("/invoice-template.png");

      // Auto-generate invoice number & today's date
      const now = new Date();
      const invoiceNumber =
        "INV-" +
        now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, "0") +
        String(now.getDate()).padStart(2, "0") +
        "-" +
        Math.floor(1000 + Math.random() * 9000);

      const invoiceDate = now.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      // ── Coordinate map ───────────────────────────────────────────────────
      // Template image size: 1414 × 2000 px
      // PDF A4 page size:     595 × 842 pt
      // Scale factors:  sx = 595/1414 ≈ 0.4208  |  sy = 842/2000 ≈ 0.4210
      //
      // All absolutePosition values below were derived from pixel positions
      // in the template image converted using the scale factors above.
      // If text lands slightly off, adjust x/y here to fine-tune.
      // ─────────────────────────────────────────────────────────────────────

      const TEXT_COLOR = "#1a1a2e";
      const FONT_SIZE  = 10;

      const docDefinition = {
        pageSize: "A4",
        pageMargins: [0, 0, 0, 0],

        // Full-page template image as background
        background: () => ({
          image: templateBase64,
          width: 595,
          height: 842,
          absolutePosition: { x: 0, y: 0 },
        }),

        content: [
          // Invoice Number  (right of "Invoice Number:" label)
          {
            text: invoiceNumber,
            fontSize: FONT_SIZE,
            color: TEXT_COLOR,
            absolutePosition: { x: 370, y: 62 },
          },

          // Invoice Date  (right of "Invoice Date:" label)
          {
            text: invoiceDate,
            fontSize: FONT_SIZE,
            color: TEXT_COLOR,
            absolutePosition: { x: 370, y: 81 },
          },

          // Customer Name  (right of "Customer Name:" label)
          {
            text: customerName.trim() || "—",
            fontSize: FONT_SIZE,
            color: TEXT_COLOR,
            absolutePosition: { x: 200, y: 258 },
          },

          // Customer Phone  (right of "Customer Number:" label)
          {
            text: customerPhone.trim() || "—",
            fontSize: FONT_SIZE,
            color: TEXT_COLOR,
            absolutePosition: { x: 218, y: 277 },
          },

          // Description  (inside Description table cell)
          {
            text: description.trim(),
            fontSize: FONT_SIZE,
            color: TEXT_COLOR,
            absolutePosition: { x: 30, y: 358 },
          },

          // Price  (inside Price table cell)
          {
            text: `AED ${enteredAmount.toFixed(2)}`,
            fontSize: FONT_SIZE,
            color: TEXT_COLOR,
            absolutePosition: { x: 460, y: 358 },
          },

          // Total  (inside Total row)
          {
            text: `AED ${enteredAmount.toFixed(2)}`,
            fontSize: FONT_SIZE + 1,
            bold: true,
            color: TEXT_COLOR,
            absolutePosition: { x: 460, y: 448 },
          },
        ],

        defaultStyle: { font: "Helvetica" },
      };

      pdfMake.createPdf(docDefinition).download(`${invoiceNumber}.pdf`);
    } catch (e) {
      setError("PDF error: " + e.message);
    } finally {
      setPdfLoading(false);
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────

  const inputStyle = {
    width: "calc(100% - 28px)",
    display: "block",
    margin: "10px auto 24px",
    padding: 14,
    fontSize: 18,
    borderRadius: 12,
    border: "1.5px solid #d1d5db",
    outline: "none",
  };

  const labelStyle = {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  };

  const btnBase = {
    width: "100%",
    display: "block",
    padding: "18px",
    fontSize: 18,
    color: "white",
    border: "none",
    borderRadius: 14,
    cursor: "pointer",
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <main
      style={{
        maxWidth: 650,
        margin: "0 auto",
        padding: "40px 18px calc(40px + env(safe-area-inset-bottom))",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <Image
          src="/logo.png"
          alt="AE Logo"
          width={140}
          height={140}
          priority
          style={{ margin: "0 auto", display: "block" }}
        />
      </div>

      <h2 style={{ marginBottom: 30, textAlign: "center" }}>
        N-Genius Payment Link Generator
      </h2>

      {/* ── Main fields ── */}
      <label style={labelStyle}>Description</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., AE Tickets - Arsenal vs City"
        style={inputStyle}
      />

      <label style={labelStyle}>Amount (AED)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g., 260"
        type="number"
        style={inputStyle}
      />

      {/* ── Divider ── */}
      <div style={{ borderTop: "1.5px solid #e5e7eb", margin: "0 0 24px" }} />

      {/* ── Optional customer fields ── */}
      <label style={labelStyle}>
        Customer Name{" "}
        <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>
          (optional)
        </span>
      </label>
      <input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="e.g., Ahmed Al Mansoori"
        style={inputStyle}
      />

      <label style={labelStyle}>
        Customer Phone{" "}
        <span style={{ fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>
          (optional)
        </span>
      </label>
      <input
        value={customerPhone}
        onChange={(e) => setCustomerPhone(e.target.value)}
        placeholder="e.g., +971 50 123 4567"
        type="tel"
        style={inputStyle}
      />

      {/* ── Buttons ── */}
      <button
        onClick={generate}
        disabled={loading}
        style={{
          ...btnBase,
          background: "#2f5ec4",
          marginBottom: 14,
          opacity: loading ? 0.7 : 1,
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        {loading ? "Generating..." : "Generate Link"}
      </button>

      <button
        onClick={generateInvoicePDF}
        disabled={pdfLoading}
        style={{
          ...btnBase,
          background: "#0f172a",
          marginBottom: 24,
          opacity: pdfLoading ? 0.7 : 1,
          cursor: pdfLoading ? "not-allowed" : "pointer",
        }}
      >
        {pdfLoading ? "Generating PDF…" : "📄 Generate Invoice PDF"}
      </button>

      {/* ── Error ── */}
      {error && (
        <p style={{ color: "crimson", marginTop: 16 }}>{error}</p>
      )}

      {/* ── Generated link ── */}
      {link && (
        <div style={{ marginTop: 10 }}>
          {copyStatus === "success" && (
            <p style={{ color: "green", fontWeight: "bold", marginBottom: 10 }}>
              Copied ✅
            </p>
          )}

          <input
            ref={linkInputRef}
            value={link}
            readOnly
            style={{
              ...inputStyle,
              fontSize: 14,
              marginBottom: 14,
            }}
          />

          <button
            onClick={tapToCopy}
            style={{ ...btnBase, background: "#0f172a", marginBottom: 24 }}
          >
            Tap to Copy
          </button>
        </div>
      )}
    </main>
  );
}
