// services/fallbackExtractionService.js
const Tesseract = require("tesseract.js");
const pdfParse = require("pdf-parse");

class FallbackExtractionService {
  constructor() {
    this.simplePatterns = {
      aadhaar: /\b\d{4}\s?\d{4}\s?\d{4}\b/,
      pan: /[A-Z]{5}[0-9]{4}[A-Z]{1}/,
      account: /\d{9,18}/,
      ifsc: /^[A-Z]{4}0[A-Z0-9]{6}$/,
      date: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/
    };
  }

  async extractTextFromImage(imagePath) {
    try {
      const { data: { text } } = await Tesseract.recognize(
        imagePath,
        'eng',
        { logger: m => console.log(m.status) }
      );
      return text;
    } catch (error) {
      console.error("Tesseract failed:", error);
      return "";
    }
  }

  async extractBasicBankInfo(images) {
    const results = {
      accountDetails: {
        accountNumber: null,
        bankName: null,
        accountHolderName: null,
        ifscCode: null
      },
      monthlyAnalysis: [],
      confidence: 0.3
    };

    // Simple pattern matching from extracted text
    for (const image of images.slice(0, 5)) { // Process only first 5 pages
      const text = await this.extractTextFromImage(image);
      
      // Look for patterns
      const aadhaarMatch = text.match(this.simplePatterns.aadhaar);
      const panMatch = text.match(this.simplePatterns.pan);
      const accountMatch = text.match(this.simplePatterns.account);
      const ifscMatch = text.match(this.simplePatterns.ifsc);
      
      if (accountMatch && !results.accountDetails.accountNumber) {
        results.accountDetails.accountNumber = accountMatch[0];
      }
      
      if (ifscMatch && !results.accountDetails.ifscCode) {
        results.accountDetails.ifscCode = ifscMatch[0];
      }
    }
    
    return results;
  }
}

module.exports = new FallbackExtractionService();