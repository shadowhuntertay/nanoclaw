# PDF Reader

Extract text from PDF files using `pdf-reader` (powered by poppler-utils).

## Commands

```bash
# Read a local PDF file (e.g. one sent by the user)
pdf-reader attachments/document.pdf

# Fetch and read a PDF from a URL
pdf-reader fetch https://example.com/report.pdf

# Show metadata (page count, title, author, etc.)
pdf-reader info attachments/document.pdf
```

## When a user sends a PDF

PDF files sent via Telegram are saved to `attachments/` in the group workspace.
The message content will contain `[PDF: attachments/filename.pdf]` — use that
path with `pdf-reader` to extract the text.

## Notes

- Only works on text-based PDFs. Scanned/image PDFs will produce little or no text.
- For image-based PDFs, use agent-browser to open the URL visually instead.
- Output goes to stdout. Pipe to a file if you need to save it:
  `pdf-reader attachments/doc.pdf > /tmp/doc.txt`
