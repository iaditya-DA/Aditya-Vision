import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

let inMemoryBusinessProfile = {
  name: "Aditya Vision Retail Enterprise Ltd.",
  branch: "Benipatti",
  accountantName: "Abhishek Kumar Jha",
  contactNumber: "0612-2541908",
  supportMobile: "9835012345",
  email: "contact@adityavision.com",
  address: "Aditya Vision Mega Store, Boring Road Crossing, Patna, Bihar - 800001",
  gstin: "10AABCA1234F1Z5",
  branchCount: "1",
};

/**
 * Get Business Profile details for reports and header sign-offs
 */
export const getBusinessProfile = () => {
  return inMemoryBusinessProfile;
};

export const saveBusinessProfile = (profile) => {
  inMemoryBusinessProfile = { ...inMemoryBusinessProfile, ...profile };
  if (profile.logoUrl) {
    cachedLogoDataUrl = null; // Invalidate cached logo
  }
};

let cachedLogoDataUrl = null;

/**
 * Load Aditya Vision logo as Data URL for jsPDF embedding
 */
export const loadLogoDataUrl = async (customUrl = null) => {
  const profile = getBusinessProfile();
  const targetSrc = customUrl || profile.logoUrl || "/assets/logo.png";

  if (cachedLogoDataUrl && !customUrl && targetSrc === "/assets/logo.png") {
    return cachedLogoDataUrl;
  }

  // If already a Data URL, return directly
  if (targetSrc.startsWith("data:")) {
    cachedLogoDataUrl = targetSrc;
    return targetSrc;
  }

  return new Promise((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          cachedLogoDataUrl = canvas.toDataURL("image/png");
          resolve(cachedLogoDataUrl);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = targetSrc;
    } catch {
      resolve(null);
    }
  });
};

/**
 * Clean currency string to Rs. with Indian grouping for jsPDF standard font
 */
const formatForPdf = (val, colKey = "", colType = "") => {
  if (val === null || val === undefined || val === "" || val === "-") return "-";

  const isAmount =
    colType === "amount" ||
    colKey.toLowerCase().includes("charge") ||
    colKey.toLowerCase().includes("amount") ||
    colKey.toLowerCase().includes("earnings") ||
    colKey.toLowerCase().includes("paid") ||
    colKey.toLowerCase().includes("balance") ||
    colKey.toLowerCase().includes("freight") ||
    colKey.toLowerCase().includes("revenue") ||
    colKey.toLowerCase().includes("payout");

  if (typeof val === "number" || (!isNaN(Number(val)) && isAmount)) {
    const num = Number(val);
    return `Rs. ${num.toLocaleString("en-IN")}`;
  }

  const str = String(val);
  if (str.includes("₹")) {
    return str.replace(/₹\s?/g, "Rs. ");
  }
  return str;
};

/**
 * Export tabular data directly to CSV file download
 */
export const exportToCSV = (data, filename = "export.csv", columns = null) => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }

  const hasCustomCols = Boolean(columns && columns.length > 0);
  const headers = hasCustomCols
    ? columns.map((col) => col.label)
    : Object.keys(data[0]);
  const keys = hasCustomCols
    ? columns.map((col) => col.key)
    : Object.keys(data[0]);

  const csvRows = [];
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  for (const row of data) {
    const values = keys.map((key) => {
      let val = row[key];
      if (val === null || val === undefined) val = "";
      if (typeof val === "object") val = JSON.stringify(val);
      const strVal = String(val).replace(/"/g, '""');
      return `"${strVal}"`;
    });
    csvRows.push(values.join(","));
  }

  const csvString = csvRows.join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute(
    "download",
    filename.endsWith(".csv") ? filename : `${filename}.csv`,
  );
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export tabular data directly to Excel (.xlsx) download
 */
export const exportToExcel = (
  data,
  filename = "report.xlsx",
  columns = null,
) => {
  if (!data || !data.length) {
    alert("No data available to export.");
    return;
  }

  const hasCustomCols = Boolean(columns && columns.length > 0);
  const rows = data.map((row) => {
    if (hasCustomCols) {
      const obj = {};
      columns.forEach((col) => {
        obj[col.label] = row[col.key] ?? "";
      });
      return obj;
    }
    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Aditya Vision Report");
  XLSX.writeFile(
    workbook,
    filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`,
  );
};

/**
 * Export tabular data directly to client-side PDF download with standard header,
 * Aditya Vision logo, branch & accountant sign-off, landscape auto-detection,
 * repeating headers and page numbers.
 *
 * @param {string} title
 * @param {Array<{label: string, key: string, type?: string}>} columns
 * @param {Array<Object>} rows
 * @param {string} filename
 * @param {string} filterSummary
 * @param {Object} customTotals
 */
export const exportToPDF = async (
  title,
  columns,
  rows,
  filename = "report.pdf",
  filterSummary = "",
  customTotals = null,
) => {
  if (!rows || !rows.length) {
    alert("No data available to export.");
    return;
  }

  const isLandscape = columns.length > 6;
  const doc = new jsPDF({
    orientation: isLandscape ? "landscape" : "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const profile = getBusinessProfile();
  const logoData = await loadLogoDataUrl();

  // Top-left: Logo or text branding
  if (logoData) {
    // 3:1 ratio (width 36mm, height 12mm)
    try {
      doc.addImage(logoData, "PNG", 14, 8, 36, 12);
    } catch {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(229, 57, 53);
      doc.text("ADITYA VISION", 14, 15);
    }
  } else {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(229, 57, 53);
    doc.text("ADITYA VISION", 14, 15);
  }

  // Directly below the logo: Branch and Accountant Name
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(75, 85, 99); // #4B5563
  doc.text(`Branch - ${profile.branch || "Benipatti"}`, 14, 24);
  doc.text(
    `Accountant - ${profile.accountantName || "Abhishek Kumar Jha"}`,
    14,
    28,
  );

  // Right side of header: Title, Timestamp, Filters
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(32, 33, 36);
  doc.text(title, pageWidth - 14, 14, { align: "right" });

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(107, 114, 128); // #6B7280
  doc.text(`Generated on ${timeStr}`, pageWidth - 14, 19, { align: "right" });

  if (filterSummary) {
    doc.setFontSize(7.5);
    doc.text(filterSummary, pageWidth - 14, 24, {
      align: "right",
      maxWidth: 120,
    });
  }

  // Thin red line (#E53935) under the header
  const headerBottomY = 32;
  doc.setDrawColor(229, 57, 53);
  doc.setLineWidth(0.6);
  doc.line(14, headerBottomY, pageWidth - 14, headerBottomY);

  // Prepare table headers & body
  const headers = [columns.map((c) => c.label)];
  const tableData = rows.map((r) =>
    columns.map((c) => formatForPdf(r[c.key], c.key, c.type)),
  );

  // Check columns alignment
  const columnStyles = {};
  columns.forEach((c, idx) => {
    const isNum =
      c.type === "amount" ||
      c.type === "number" ||
      c.key.toLowerCase().includes("charge") ||
      c.key.toLowerCase().includes("amount") ||
      c.key.toLowerCase().includes("earnings") ||
      c.key.toLowerCase().includes("paid") ||
      c.key.toLowerCase().includes("balance") ||
      c.key.toLowerCase().includes("freight") ||
      c.key.toLowerCase().includes("revenue") ||
      c.key.toLowerCase().includes("payout");

    if (isNum) {
      columnStyles[idx] = { halign: "right" };
    }
  });

  // Prepare Totals Row
  let foot = null;
  const hasTotals =
    customTotals ||
    columns.some(
      (c) =>
        c.type === "amount" ||
        c.type === "number" ||
        c.key.toLowerCase().includes("amount") ||
        c.key.toLowerCase().includes("charges"),
    );

  if (hasTotals) {
    const footRow = columns.map((c, idx) => {
      if (idx === 0) return "Total";
      if (customTotals && customTotals[c.key] !== undefined) {
        return formatForPdf(customTotals[c.key], c.key, c.type);
      }
      const isNum =
        c.type === "amount" ||
        c.type === "number" ||
        c.key.toLowerCase().includes("charge") ||
        c.key.toLowerCase().includes("amount") ||
        c.key.toLowerCase().includes("earnings") ||
        c.key.toLowerCase().includes("paid") ||
        c.key.toLowerCase().includes("balance") ||
        c.key.toLowerCase().includes("freight") ||
        c.key.toLowerCase().includes("revenue") ||
        c.key.toLowerCase().includes("payout");

      if (isNum) {
        const sum = rows.reduce(
          (acc, row) => acc + (Number(row[c.key]) || 0),
          0,
        );
        return formatForPdf(sum, c.key, c.type);
      }
      return "";
    });
    foot = [footRow];
  }

  const fontSize = columns.length > 10 ? 6.5 : columns.length > 6 ? 7.5 : 8.5;

  autoTable(doc, {
    head: headers,
    body: tableData,
    foot: foot,
    startY: headerBottomY + 4,
    showHead: "everyPage",
    showFoot: "lastPage",
    theme: "grid",
    headStyles: {
      fillColor: [229, 57, 53], // #E53935
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: fontSize,
      halign: "left",
      cellPadding: 2.5,
    },
    footStyles: {
      fillColor: [243, 244, 246],
      textColor: [32, 33, 36],
      fontStyle: "bold",
      fontSize: fontSize,
      cellPadding: 2.5,
    },
    styles: {
      fontSize: fontSize,
      cellPadding: 2,
      textColor: [32, 33, 36],
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 249, 251],
    },
    columnStyles: columnStyles,
    margin: { left: 14, right: 14, top: 14, bottom: 16 },
  });

  // Footer with Page Numbers
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(156, 163, 175);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 8, {
      align: "right",
    });
    doc.text(
      "Confidential — Internal Retail Record of Aditya Vision",
      14,
      pageHeight - 8,
    );
  }

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
};

/**
 * Trigger clean browser print
 */
export const printReport = (title, columns, rows) => {
  const profile = getBusinessProfile();
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Popup blocked. Please allow popups to print.");
    return;
  }

  const tableHeader = columns
    .map(
      (col) =>
        `<th style="padding: 8px 10px; background: #E53935; color: #fff; font-size: 11px; text-align: left;">${col.label}</th>`,
    )
    .join("");

  const tableRows = rows
    .map(
      (row) =>
        `<tr>${columns
          .map(
            (col) =>
              `<td style="padding: 7px 10px; border-bottom: 1px solid #E5E7EB; font-size: 11px; color: #202124;">${row[col.key] ?? "-"}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const now = new Date();
  const timeStr = `${String(now.getDate()).padStart(2, "0")}/${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title} - Aditya Vision</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #202124; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #E53935; padding-bottom: 12px; margin-bottom: 16px; }
          .logo { height: 42px; }
          .branch-info { font-size: 11px; color: #4B5563; margin-top: 4px; line-height: 1.4; }
          .meta { font-size: 11px; color: #6B7280; text-align: right; }
          .title { font-size: 16px; font-weight: bold; color: #202124; margin-bottom: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; }
          tr:nth-child(even) { background-color: #F8F9FB; }
          @media print {
            body { padding: 8px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <img src="/assets/logo.png" alt="Aditya Vision" class="logo" />
            <div class="branch-info">
              <div>Branch - ${profile.branch || "Benipatti"}</div>
              <div>Accountant - ${profile.accountantName || "Abhishek Kumar Jha"}</div>
            </div>
          </div>
          <div class="meta">
            <div class="title">${title}</div>
            <div>Generated on ${timeStr}</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>${tableHeader}</tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
};

/**
 * Standard Delivery Export Columns Definition
 */
export const DELIVERY_EXPORT_COLUMNS = [
  { key: "deliveryId", label: "Delivery ID" },
  { key: "invoiceNumber", label: "Invoice No." },
  { key: "customerName", label: "Customer Name" },
  { key: "customerPhone", label: "Customer Contact" },
  { key: "productName", label: "Appliance / Item" },
  { key: "driverName", label: "Assigned Driver" },
  { key: "deliveryDate", label: "Delivery Date" },
  { key: "distanceKm", label: "Distance (KM)", type: "number" },
  { key: "deliveryCharge", label: "Delivery Charge (Rs.)", type: "amount" },
  { key: "status", label: "Delivery Status" },
  { key: "paymentStatus", label: "Payment Status" },
  { key: "totalAmount", label: "Total Order (Rs.)", type: "amount" },
  { key: "paidAmount", label: "Paid Amount (Rs.)", type: "amount" },
  { key: "outstandingAmount", label: "Outstanding (Rs.)", type: "amount" },
];

/**
 * Standard Driver Export Columns Definition (permission-gated)
 */
export const getDriverExportColumns = (canViewFullBank) => {
  const base = [
    { key: "code", label: "Driver Code" },
    { key: "name", label: "Driver Name" },
    { key: "phone", label: "Mobile Contact" },
    { key: "vehicleType", label: "Vehicle Type" },
    { key: "vehicleNumber", label: "Vehicle Reg No." },
    { key: "status", label: "Status" },
    { key: "bankName", label: "Bank Name" },
    { key: "accountHolderName", label: "A/C Holder Name" },
    { key: "accountNumber", label: canViewFullBank ? "A/C Number" : "A/C Number (Masked)" },
    { key: "ifscCode", label: "IFSC Code" },
    { key: "branchName", label: "Branch Name" },
  ];

  if (canViewFullBank) {
    base.push({ key: "upiId", label: "UPI ID" });
  }

  return base;
};
