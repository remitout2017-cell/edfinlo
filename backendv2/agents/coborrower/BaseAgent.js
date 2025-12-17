// agents/coborrower/BaseAgent.js
const axios = require('axios');
const config = require("../../config/config");
const fs = require('fs');
const mime = require('mime-types');

class BaseAgent {
  constructor(model = "amazon/nova-2-lite-v1:free", maxRetries = 3) {
    this.model = model;
    this.maxRetries = maxRetries;
    this.apiKey = config.ai.openRouterApiKey;
    this.baseUrl = config.ai.openRouterBaseUrl || "https://openrouter.ai/api/v1";
    
    console.log(`🤖 Initializing OpenRouter agent with model: ${this.model}`);
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Loan Application System',
        'Content-Type': 'application/json',
      },
      timeout: 180000, // 3 minutes for large documents
    });
  }

  async invokeWithRetry(messages, retryCount = 0) {
    try {
      console.log(`🤖 OpenRouter call attempt ${retryCount + 1}/${this.maxRetries}`);
      console.log(`📤 Sending ${messages[0]?.content?.length || 0} content parts`);
      
      const response = await this.client.post('/chat/completions', {
        model: this.model,
        messages: messages,
        max_tokens: 8192,
        temperature: 0.05,
      });

      const content = response.data.choices?.[0]?.message?.content || "";
      
      if (!content || content.trim() === "") {
        console.warn("⚠️ Empty response content from OpenRouter");
        console.log("Response structure:", JSON.stringify(response.data, null, 2).substring(0, 500));
        
        if (retryCount < this.maxRetries) {
          const delay = 3000 * Math.pow(2, retryCount);
          console.log(`⏳ Empty response, retrying in ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.invokeWithRetry(messages, retryCount + 1);
        }
      }

      return {
        content: content,
        text: content,
        rawResponse: response.data
      };
    } catch (error) {
      console.error(`❌ OpenRouter API error attempt ${retryCount + 1}:`);
      
      if (error.response) {
        console.error(`Status: ${error.response.status}`);
        console.error(`Data: ${JSON.stringify(error.response.data)}`);
        
        if (error.response.status === 429 && retryCount < this.maxRetries) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          const delay = parseInt(retryAfter) * 1000 * Math.pow(2, retryCount) + Math.random() * 1000;
          console.log(`⏳ Rate limited. Retrying in ${Math.round(delay/1000)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.invokeWithRetry(messages, retryCount + 1);
        }
      } else if (error.request) {
        console.error('No response received:', error.message);
      } else {
        console.error('Request setup error:', error.message);
      }
      
      if (retryCount < this.maxRetries && !error.response?.status) {
        const delay = 2000 * Math.pow(2, retryCount);
        console.log(`⏳ Retrying in ${Math.round(delay/1000)}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.invokeWithRetry(messages, retryCount + 1);
      }
      
      throw error;
    }
  }

  createImageContent(images, limit = 5) {
    const limitedImages = images.slice(0, limit);
    console.log(`🖼️ Creating image content for ${limitedImages.length} images (limited from ${images.length})`);
    
    return limitedImages.map((img, index) => {
      try {
        if (img.startsWith('data:')) {
          return {
            type: "image_url",
            image_url: {
              url: img,
              detail: "low" // Use low detail to reduce token usage
            }
          };
        } else if (img.startsWith('http')) {
          return {
            type: "image_url",
            image_url: {
              url: img,
              detail: "low"
            }
          };
        } else {
          // Read local file and convert to base64
          const stats = fs.statSync(img);
          if (stats.size > 5 * 1024 * 1024) { // 5MB
            console.warn(`⚠️ Image ${img} is too large (${Math.round(stats.size/1024/1024)}MB), skipping`);
            return null;
          }
          
          const imageBuffer = fs.readFileSync(img);
          const base64Image = imageBuffer.toString('base64');
          const mimeType = mime.lookup(img) || 'image/jpeg';
          
          return {
            type: "image_url",
            image_url: {
              url: `data:${mimeType};base64,${base64Image}`,
              detail: "low"
            }
          };
        }
      } catch (err) {
        console.warn(`⚠️ Could not process image ${index}:`, err.message);
        return null;
      }
    }).filter(item => item !== null);
  }

  parseResponse(response) {
    try {
      let raw = typeof response?.content === "string"
        ? response.content
        : response?.text || "";

      console.log(`📝 Raw response length: ${raw.length} characters`);
      
      if (raw.length < 10) {
        console.warn("⚠️ Response too short, might be empty");
        console.log("Full response object:", JSON.stringify(response, null, 2).substring(0, 1000));
        throw new Error("Empty or very short response from AI");
      }

      const text = (raw || "").trim();
      
      // Log first 200 chars for debugging
      console.log(`📄 Response preview: ${text.substring(0, 200)}...`);
      
      // Remove markdown code blocks
      const cleanedText = text
        .replace(/^```json\s*/gi, "")
        .replace(/^```\s*/gi, "")
        .replace(/```\s*$/g, "")
        .replace(/^`\s*/g, "")
        .replace(/\s*`$/g, "")
        .trim();

      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/) || cleanedText.match(/\[[\s\S]*\]/);

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          console.log("✅ Successfully parsed JSON response");
          return parsed;
        } catch (parseError) {
          console.error("❌ JSON parse error:", parseError.message);
          console.error("Problematic JSON:", jsonMatch[0].substring(0, 500));
          throw parseError;
        }
      }

      console.warn("⚠️ No JSON found in response. Full text:", text.substring(0, 500));
      throw new Error("No JSON found in response");
    } catch (error) {
      console.error("❌ Failed to parse AI response:", error.message);
      throw error;
    }
  }
}

module.exports = BaseAgent;