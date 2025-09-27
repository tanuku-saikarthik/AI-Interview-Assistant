import * as pdfjsLib from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker?url";
import mammoth from "mammoth";
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
/**
 * Extract text from a PDF resume
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}
/**
 * Extract text from a DOCX resume
 * @param {File} file
 * @returns {Promise<string>}
 */
export async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}
/**
 * Parse Name, Email, and Phone number from text
 * @param {string} text
 * @returns {{ name: string, email: string, phone: string }}
 */
export function findNameEmailPhone(text) {
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-z]{2,}/i);
  const phoneMatch = text.match(
    /(?:\+?\d{1,3}[-.\s]?)?(?:\d{10}|\d{3}[-.\s]\d{3}[-.\s]\d{4})/
  );
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  let name = "";
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    if (
      /[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(line) &&
      !line.toLowerCase().includes("resume")
    ) {
      name = line.split("|")[0].split(",")[0];
      break;
    }
  }
  return {
    name: name || "",
    email: emailMatch ? emailMatch[0] : "",
    phone: phoneMatch ? phoneMatch[0] : "",
  };
}
