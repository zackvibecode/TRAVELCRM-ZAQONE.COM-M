/**
 * Extract plain text from a PDF buffer using unpdf (pdf.js under the hood).
 * Runs inside the Worker with nodejs_compat; pdf.js needs a DOM-ish
 * environment, so we rely on the pure-JS build and disable the worker.
 */

export interface PdfExtraction {
  text: string;
  pages: number;
  /** True when the PDF has no extractable text layer (scanned image). */
  likelyScanned: boolean;
}

/**
 * Extract text from a PDF file.
 * Returns empty text (rather than throwing) for encrypted or broken PDFs so
 * the caller can fall back to asking the user to paste the itinerary.
 */
export async function extractPdfText(bytes: ArrayBuffer): Promise<PdfExtraction> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const doc = await getDocumentProxy(new Uint8Array(bytes));
    const { totalPages, text } = await extractText(doc, { mergePages: true });

    const cleaned = text
      .replace(/\r\n/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    return {
      text: cleaned,
      pages: totalPages,
      likelyScanned: cleaned.replace(/\s/g, "").length < totalPages * 20,
    };
  } catch {
    return { text: "", pages: 0, likelyScanned: true };
  }
}

/**
 * Extract text from an image (JPG/PNG) using OCR via the AI provider's
 * vision capability is not available here — instead we return a clear
 * signal so the UI can ask the user to paste the itinerary as text.
 */
export function isPdf(bytes: ArrayBuffer): boolean {
  const head = new Uint8Array(bytes.slice(0, 5));
  const signature = String.fromCharCode(...head);
  return signature.startsWith("%PDF");
}
