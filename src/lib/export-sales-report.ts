import ExcelJS from "exceljs";
import type { ShareEntry } from "@/lib/sales-report-api";

/**
 * Build a formatted .xlsx sales report ("Laporan Sale Bulanan") and trigger
 * a browser download. Everything the owner asked for is on the sheet:
 * a title block with the report name + month, a styled header, RM-formatted
 * amounts, status, dates, and a bold totals row.
 */

export interface SalesReportExportInput {
  month: string;
  monthLabel: string;
  salesName: string;
  entries: ShareEntry[];
  includeSalesColumn: boolean;
}

const BLUE = "FF1D4ED8";
const BLUE_SOFT = "FFEFF6FF";
const GREY_HEAD = "FF6B7280";
const GREY_ROW = "FFE5E7EB";

function statusLabel(s: string): string {
  return s === "confirm" ? "Confirm" : s === "partial" ? "Partial" : "Cancel";
}

function statusFill(s: string): string | undefined {
  if (s === "confirm") return "FFDCFCE7";
  if (s === "partial") return "FFFEF3C7";
  return "FFFEE2E2";
}

function statusColor(s: string): string {
  if (s === "confirm") return "FF166534";
  if (s === "partial") return "FF92400E";
  return "FF991B1B";
}

export async function exportSalesReportXlsx(input: SalesReportExportInput): Promise<void> {
  const { month, monthLabel, salesName, entries, includeSalesColumn } = input;

  const wb = new ExcelJS.Workbook();
  wb.creator = "TravelOS CRM";
  wb.created = new Date();
  const ws = wb.addWorksheet("Laporan", {
    views: [{ state: "frozen", ySplit: 7 }],
  });

  const columnDefs: Array<{ key: string; width: number; header: string }> = [
    { key: "no", width: 6, header: "Bil" },
    { key: "customer", width: 30, header: "Nama Customer" },
    { key: "invoiceNo", width: 16, header: "No. Invoice" },
    { key: "packageName", width: 22, header: "Pakej" },
    { key: "packs", width: 8, header: "Pack" },
    { key: "source", width: 20, header: "Sumber Lead" },
    { key: "total", width: 20, header: "Total Invoice (RM)" },
    { key: "status", width: 11, header: "Status" },
    ...(includeSalesColumn ? [{ key: "sales", width: 20, header: "Sales" }] : []),
    { key: "date", width: 13, header: "Tarikh" },
  ];

  // ---- Title block -------------------------------------------------------
  const colSpan = columnDefs.length;
  ws.mergeCells(1, 1, 1, colSpan);
  const title = ws.getCell(1, 1);
  title.value = "LAPORAN SALE BULANAN";
  title.font = { size: 18, bold: true, color: { argb: BLUE } };
  title.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 30;

  ws.mergeCells(2, 1, 2, colSpan);
  const sub = ws.getCell(2, 1);
  sub.value = `${monthLabel}`;
  sub.font = { size: 13, bold: true, color: { argb: "FF111827" } };
  sub.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 22;

  ws.getCell(3, 1).value = "Sales";
  ws.getCell(3, 2).value = salesName;
  ws.getCell(4, 1).value = "Dijana pada";
  ws.getCell(4, 2).value = new Date().toLocaleString("en-MY");
  for (const r of [3, 4]) {
    ws.getCell(r, 1).font = { size: 10, bold: true, color: { argb: GREY_HEAD } };
    ws.getCell(r, 2).font = { size: 10, color: { argb: "FF374151" } };
  }

  ws.getCell(6, 1).value = `Bilangan customer: ${entries.length}`;
  ws.getCell(6, 1).font = { size: 10, italic: true, color: { argb: GREY_HEAD } };

  // ---- Header + data -----------------------------------------------------
  // Column widths only — headers are written below so they don't overwrite
  // the title block on row 1.
  ws.columns = columnDefs.map((c) => ({ key: c.key, width: c.width }));
  const headerRow = ws.getRow(7);
  headerRow.height = 24;
  columnDefs.forEach((c, idx) => {
    headerRow.getCell(idx + 1).value = c.header;
  });
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = {
      bottom: { style: "thin", color: { argb: BLUE } },
    };
  });

  const totalCol = 7;
  entries.forEach((e, i) => {
    const row = ws.addRow({
      no: i + 1,
      customer: e.customerName,
      invoiceNo: e.invoiceNo || "-",
      packageName: e.packageName || "-",
      packs: e.packs,
      source: e.source || "-",
      total: e.invoiceTotal,
      status: statusLabel(e.status),
      ...(includeSalesColumn ? { sales: e.userName } : {}),
      date: e.createdAt.slice(0, 10),
    });
    row.height = 20;
    const stripe = i % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFE5E7EB" } },
      };
      if (stripe) {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BLUE_SOFT } };
      }
      const centered =
        colNumber === 1 || colNumber === 5 || colNumber === totalCol || colNumber === 8;
      cell.alignment = { horizontal: centered ? "center" : "left", vertical: "middle" };
      cell.font = { size: 10.5, color: { argb: "FF111827" } };
    });
    row.getCell(totalCol).numFmt = '"RM" #,##0.00';
    row.getCell(totalCol).font = { size: 10.5, bold: true, color: { argb: "FF111827" } };
    const statusCell = row.getCell(8);
    statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill(e.status)! } };
    statusCell.font = { size: 10, bold: true, color: { argb: statusColor(e.status) } };
  });

  // ---- Totals ------------------------------------------------------------
  const totalPacks = entries.reduce((s, e) => s + e.packs, 0);
  const totalInvoice = entries.reduce((s, e) => s + e.invoiceTotal, 0);
  ws.addRow([]);
  const totalRow = ws.addRow({
    no: "",
    customer: "JUMLAH",
    invoiceNo: "",
    packageName: "",
    packs: totalPacks,
    source: `${entries.length} customer`,
    total: totalInvoice,
    status: "",
    ...(includeSalesColumn ? { sales: "" } : {}),
    date: "",
  });
  totalRow.height = 24;
  totalRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GREY_ROW } };
    cell.font = { bold: true, size: 11, color: { argb: "FF111827" } };
    cell.border = { top: { style: "medium", color: { argb: BLUE } } };
  });
  totalRow.getCell(2).alignment = { horizontal: "left", vertical: "middle" };
  totalRow.getCell(totalCol).numFmt = '"RM" #,##0.00';
  totalRow.getCell(totalCol).alignment = { horizontal: "center", vertical: "middle" };
  totalRow.getCell(5).alignment = { horizontal: "center", vertical: "middle" };

  // ---- Download ----------------------------------------------------------
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Laporan-Sale-Bulanan-${month}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
