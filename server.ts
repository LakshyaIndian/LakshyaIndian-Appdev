import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import { createRequire } from "module";
import fs from "fs";

console.log("Starting server.ts...");

const require = createRequire(import.meta.url);

const storage = multer.memoryStorage();
const upload = multer({ storage });

async function extractTextWithPdfJs(buffer: Buffer) {
  let pdfjs: any;
  try {
    pdfjs = require("pdfjs-dist/build/pdf.js");
  } catch (err) {
    try {
      pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
    } catch (legacyErr) {
      console.error("Failed to load pdfjs-dist:", legacyErr);
      return null;
    }
  }

  try {
    const data = new Uint8Array(buffer);
    const loadingTask = pdfjs.getDocument({
      data,
      useSystemFonts: true,
      disableFontFace: true,
      isEvalSupported: false,
    });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(" ");
      fullText += pageText + "\n";
    }
    return fullText.trim();
  } catch (err: any) {
    console.error("pdfjs-dist extraction failed:", err.message);
    return null;
  }
}

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(express.json());

    // Health check route
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok" });
    });

    // API Route for PDF Parsing
    app.post("/api/parse-pdf", upload.single("pdf"), async (req: any, res: any) => {
      try {
        if (!req.file) {
          return res.status(400).json({ error: "No file uploaded" });
        }

        console.log("Parsing PDF:", req.file.originalname, "Size:", req.file.size);

        // Lazy load pdf-parse
        let pdfParse: any;
        try {
          pdfParse = require("pdf-parse");
        } catch (err) {
          console.error("Failed to load pdf-parse:", err);
        }

        // Try pdf-parse first
        let parseFunc: any;
        if (typeof pdfParse === 'function') {
          parseFunc = pdfParse;
        } else if (pdfParse && typeof pdfParse.default === 'function') {
          parseFunc = pdfParse.default;
        }

        let text = "";
        if (typeof parseFunc === 'function') {
          try {
            const data = await parseFunc(req.file.buffer);
            text = data?.text || "";
          } catch (err: any) {
            console.log("pdf-parse failed:", err.message);
          }
        }

        // Fallback to pdfjs-dist if pdf-parse failed or returned no text
        if (!text) {
          console.log("Attempting extraction with pdfjs-dist...");
          const pdfJsText = await extractTextWithPdfJs(req.file.buffer);
          if (pdfJsText) {
            text = pdfJsText;
          }
        }

        if (!text) {
          return res.status(422).json({ error: "Could not extract text from this PDF. It might be scanned, encrypted, or the format is unsupported." });
        }

        console.log("Successfully extracted text. Length:", text.length);
        res.json({ text });
      } catch (error: any) {
        console.error("PDF Parsing Error:", error);
        res.status(500).json({ 
          error: "Failed to parse PDF: " + (error.message || "Unknown extraction error.")
        });
      }
    });

    // Vite middleware for development
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (err: any) {
    console.error("Failed to start server:", err.message);
    process.exit(1);
  }
}

startServer();
