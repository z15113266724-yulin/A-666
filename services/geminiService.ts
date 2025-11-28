import { GoogleGenAI, Type } from "@google/genai";
import { ProductAnalysis, AspectRatio } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to handle API calls with retry for 429 errors
async function callWithRetry<T>(fn: () => Promise<T>, retries = 10, initialDelay = 3000): Promise<T> {
  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // Extensive check for Rate Limit / Resource Exhausted errors
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.status === 'RESOURCE_EXHAUSTED' ||
        (error?.message && error.message.toLowerCase().includes('quota')) ||
        (error?.message && error.message.toLowerCase().includes('resource_exhausted')) ||
        (error?.message && error.message.includes('429'));
      
      if (isRateLimit && i < retries - 1) {
        // Exponential backoff: 3s, 6s, 12s, 24s... capped at 30s
        const backoff = Math.min(initialDelay * Math.pow(2, i), 30000);
        console.warn(`Rate limit hit (Attempt ${i+1}/${retries}). Retrying in ${backoff/1000}s...`);
        await wait(backoff);
        continue;
      }
      // If it's not a rate limit error, or we ran out of retries, throw immediately
      throw error;
    }
  }
  throw lastError;
}

/**
 * Analyzes uploaded product images (single or multiple).
 */
export const analyzeProductImage = async (base64Images: string[]): Promise<ProductAnalysis> => {
  const isMulti = base64Images.length > 1;
  
  const prompt = `
    Analyze ${isMulti ? 'these product images' : 'this product image'} for an Amazon listing. 
    1. Identify the product name/type. ${isMulti ? 'If multiple different products are shown, identify them as a set.' : ''}
    2. Write a short visual description.
    3. List 3 key selling points visualizable in a photo.
    4. Generate exactly 8 distinct photography scenarios suitable for Amazon.
       - Include: White background studio shot, Lifestyle usage shot, Close-up detail shot, In-context environment shot.
       - Scenarios MUST be descriptive prompt fragments (e.g., "placed on a modern marble kitchen counter with sunlight").
       ${isMulti ? '- Since multiple images were provided, include scenarios for a "Group Shot" or "Collection Layout" showing all items together.' : ''}
       - IMPORTANT: Do NOT suggest any copyrighted themes, famous characters, specific third-party brands, or trademarked visual elements. Keep scenarios generic, professional, and commercially safe.
  `;

  const imageParts = base64Images.map(data => ({
    inlineData: { mimeType: "image/jpeg", data }
  }));

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          ...imageParts,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            sellingPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
            scenarios: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["name", "description", "sellingPoints", "scenarios"]
        }
      }
    });

    const text = response.text;
    if (!text) throw new Error("Failed to analyze product.");
    return JSON.parse(text) as ProductAnalysis;
  });
};

/**
 * Generates a single image based on source images and a scenario.
 */
export const generateScenarioImage = async (
  base64Sources: string[],
  scenarioPrompt: string,
  ratio: AspectRatio
): Promise<string> => {
  
  const model = "gemini-2.5-flash-image";
  const isMulti = base64Sources.length > 1;

  const fullPrompt = `
    Create a professional, high-quality product photography image.
    Subject: ${isMulti ? 'The products' : 'The product'} in the reference image(s).
    Scenario: ${scenarioPrompt}.
    Requirements:
    - Keep the product looking EXACTLY like the reference (colors, branding, shape).
    - ${isMulti ? 'Arrange the products naturally together in the scene (Group Shot).' : ''}
    - Professional lighting and composition.
    - Photorealistic.
    - No text overlays.
    
    SAFETY & COPYRIGHT RESTRICTIONS:
    - STRICTLY AVOID creating any copyrighted characters, famous people, or known intellectual property (e.g., Disney, Marvel, famous movies).
    - DO NOT include logos, brands, or trademarks other than those explicitly present on the source product itself.
    - Ensure all background elements are generic (e.g., "generic modern kitchen" instead of a specific branded interior).
    - If the scenario prompts for a specific brand or character, IGNORE that part and use a generic equivalent.
  `;

  const imageParts = base64Sources.map(data => ({
    inlineData: { mimeType: "image/jpeg", data }
  }));

  return callWithRetry(async () => {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          { text: fullPrompt },
          ...imageParts 
        ]
      },
      config: {
        imageConfig: {
          aspectRatio: ratio,
        }
      }
    });

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:image/png;base64,${part.inlineData.data}`;
        }
      }
    }
    throw new Error("No image generated.");
  });
};