"use client";

import { useRef, useState } from "react";
import Image from "next/image";

export default function Home() {
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Optional fields (not mandatory)
  const [customerName, setCustomerName] = useState("");
  const [customerNumber, setCustomerNumber] = useState("");

  const [loading, setLoading] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [link, setLink] = useState("");
  const [error, setError] = useState("");
  const [copyStatus, setCopyStatus] = useState("idle");

  const linkInputRef = useRef(null);

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

  async function generateLink() {
    setError("");
    setLink("");
    setCopyStatus("idle");

    const enteredAmount = Number(amount);

    if (!description.trim()) return setError("Please enter a description.");
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0)
      return setError("Please enter a valid amount > 0.");

    // Payment API expects minor units (fils)
    const apiAmount = Math.round(enteredAmount * 100);

    setLoading(true);
    try {
      const res = await fetch("/api/create-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          amount: apiAmount,
        }),
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

  async function generatePdf() {
    setError("");
    const enteredAmount = Number(amount);

    if (!description.trim()) return setError("Please enter a description.");
    if (!Number.isFinite(enteredAmount) || enteredAmount <= 0)
      return setError("Please enter a valid amount > 0.");

    setPdfLoading(true);
    try {
      const res = await fetch("/api/invoice-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: customerName.trim(),
          customerNumber: customerNumber.trim(),
          description: description.trim(),
          amountAed: enteredAmount,     // PDF uses AED as typed
          paymentUrl: link || "",       // include if exists
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to generate PDF");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // iPhone: open in new tab (best behavior)
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      if (isIOS) {
        window.open(url, "_blank");
        return;
      }

      // Desktop: download file
      const a = document.createElement("a");
      a.href = url;
      a.download = "invoice.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    } catch (e) {
      setError(e.message);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 650,
        margin: "0 auto",
        padding: "40px 18px calc(60px + env(safe-area-inset-bottom))",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Logo centered */}
      <div style={{ textAlign: "center", marginBottom: 18 }}>
        <Image
          src="/logo.png"
          alt="AE Tickets"
          width={120}
          height={120}
          priority
          style={{ margin: "0 auto", display: "block" }}
        />
      </div>

      <h2 style={{ marginBottom: 26, textAlign: "center" }}>
        N-Genius Payment Link Generator
      </h2>

      <label>Customer Name (optional)</label>
      <input
        value={customerName}
        onChange={(e) => setCustomerName(e.target.value)}
        placeholder="e.g., Ahmed"
        style={{
          width: "calc(100% - 24px)",
          display: "block",
          margin: "10px auto 18px",
          padding: 14,
          fontSize: 16,
          borderRadius: 12,
        }}
      />

      <label>Customer Number (optional)</label>
      <input
        value={customerNumber}
        onChange={(e) => setCustomerNumber(e.target.value)}
        placeholder="e.g., +97150xxxxxxx"
        style={{
          width: "calc(100% - 24px)",
          display: "block",
          margin: "10px auto 24px",
          padding: 14,
          fontSize: 16,
          borderRadius: 12,
        }}
      />

      <label>Description</label>
      <input
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g., AE Tickets - Arsenal vs City"
        style={{
          width: "calc(100% - 24px)",
          display: "block",
          margin: "10px auto 24px",
          padding: 14,
          fontSize: 18,
          borderRadius: 12,
        }}
      />

      <label>Amount (AED)</label>
      <input
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="e.g., 260"
        type="number"
        style={{
          width: "calc(100% - 24px)",
          display: "block",
          margin: "10px auto 28px",
          padding: 14,
          fontSize: 18,
          borderRadius: 12,
        }}
      />

      <button
        onClick={generateLink}
        disabled={loading}
        style={{
          width: "calc(100% - 24px)",
          display: "block",
          margin: "0 auto 14px",
          padding: "16px 18px",
          fontSize: 18,
          background: "#2f5ec4",
          color: "white",
          border: "none",
          borderRadius: 14,
        }}
      >
        {loading ? "Generating..." : "Generate Link"}
      </button>

      <button
        onClick={generatePdf}
        disabled={pdfLoading}
        style={{
          width: "calc(100% - 24px)",
          display: "block",
          margin: "0 auto 18px",
          padding: "16px 18px",
          fontSize: 18,
          background: "#111827",
          color: "white",
          border: "none",
          borderRadius: 14,
        }}
      >
        {pdfLoading ? "Creating PDF..." : "Generate PDF Invoice"}
      </button>

      {error && <p style={{ color: "crimson", marginTop: 10 }}>{error}</p>}

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
              width: "calc(100% - 24px)",
              display: "block",
              margin: "10px auto 16px",
              padding: 14,
              fontSize: 14,
              borderRadius: 12,
            }}
          />

          <button
            onClick={tapToCopy}
            style={{
              width: "calc(100% - 24px)",
              display: "block",
              margin: "0 auto",
              padding: "16px 14px",
              fontSize: 18,
              background: "#0f172a",
              color: "white",
              border: "none",
              borderRadius: 14,
            }}
          >
            Tap to Copy
          </button>
        </div>
      )}

      {/* extra iPhone bottom space */}
      <div style={{ height: "calc(120px + env(safe-area-inset-bottom))" }} />
    </main>
  );
}
