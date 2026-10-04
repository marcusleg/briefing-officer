const escapePdfString = (text: string) => text.replace(/[\\()]/g, "\\$&");

/**
 * Builds a minimal PDF with one page per entry in `pages`, each showing its
 * text in a single line. A null page draws only a rectangle, like a scan with
 * no text layer. `encrypted` adds a standard security handler whose user
 * password is not empty, so the document cannot be opened without it.
 */
export const buildPdf = ({
  pages,
  author,
  encrypted = false,
}: {
  pages: (string | null)[];
  author?: string;
  encrypted?: boolean;
}) => {
  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "", // page tree, filled in once the page ids are known
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  const pageIds: number[] = [];
  for (const text of pages) {
    const content =
      text === null
        ? "0 0 1 rg 72 72 200 200 re f"
        : `BT /F1 12 Tf 72 720 Td (${escapePdfString(text)}) Tj ET`;
    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
    const contentId = objects.length;
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`,
    );
    pageIds.push(objects.length);
  }
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let trailer = `/Size ${objects.length + 1} /Root 1 0 R`;
  if (author !== undefined) {
    objects.push(`<< /Author (${escapePdfString(author)}) >>`);
    trailer += ` /Info ${objects.length} 0 R`;
  }
  if (encrypted) {
    const hash = "ab".repeat(32);
    objects.push(
      `<< /Filter /Standard /V 1 /R 2 /O <${hash}> /U <${hash}> /P -4 >>`,
    );
    trailer += ` /Encrypt ${objects.length} 0 R /ID [<${"cd".repeat(16)}> <${"cd".repeat(16)}>]`;
  }

  let pdf = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = pdf.length;
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`)
    .join("");
  pdf += `trailer\n<< ${trailer} >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return pdf;
};
