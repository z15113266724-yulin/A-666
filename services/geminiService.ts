import { GoogleGenAI, Type } from "@google/genai";
import { ProductAnalysis, AspectRatio } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to wait
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to handle API calls with retry
async function callWithRetry<T>(fn: () => Promise<T>, retries = 3, initialDelay = 1000): Promise<T> {
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
        // Exponential backoff
        const backoff = Math.min(initialDelay * Math.pow(2, i), 10000);
        console.warn(`Rate limit hit (Attempt ${i+1}/${retries}). Retrying in ${backoff/1000}s...`);
        await wait(backoff);
        continue;
      }
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
    
    TASK:
    1. Identify the product name/type. ${isMulti ? 'These images represent a SET or COLLECTION of items. Identify them as a cohesive group.' : ''}
    2. Write a short visual description.
    3. List 3 key selling points visualizable in a photo.
    4. Generate exactly 8 distinct photography scenarios suitable for Amazon.
       - Scenarios MUST be descriptive prompt fragments (e.g., "placed on a modern marble kitchen counter with sunlight").
       ${isMulti ? 
         '- IMPORTANT: Since multiple source images are provided, at least 4 scenarios MUST be "Group Shots" or "Knolling Layouts" that display ALL items together comfortably.' : 
         '- Include: White background studio shot, Lifestyle usage shot, Close-up detail shot.'}
       - ENSURE scenarios are generic and commercially safe.
       - STRICTLY FORBIDDEN: Do not suggest scenarios involving specific celebrities, copyrighted characters (Disney, Marvel, etc.), or specific competitor brands.
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
  ratio: AspectRatio,
  customInstruction?: string
): Promise<string> => {
  
  const model = "gemini-2.5-flash-image";
  const isMulti = base64Sources.length > 1;

  const fullPrompt = `
    You are a professional product photographer and 3D rendering expert. 
    Your goal is to generate a high-end Amazon product listing image with PIXEL-PERFECT product accuracy.

    SOURCE INFORMATION:
    - Input: ${base64Sources.length} reference image(s).
    - Subject: The product(s) shown in the reference images.
    
    STEP-BY-STEP GENERATION PROTOCOL:
    
    1. **GEOMETRY & APPEARANCE LOCK (CRITICAL)**: 
       - Before placing the product in a scene, look at the source image and "mentally construct" the exact 3D geometry of the object.
       - **Ignore "standard" designs.** If the source object looks different from a generic version of that item, follow the SOURCE, not the generic idea.
       - **Example:** If the source implies a sock WITHOUT a colored heel patch, DO NOT add a heel patch, even if most socks have them.
       - **Example:** If the bottle has no label, keep it plain. If it has a specific curve, keep that curve exactly.
       - Replicate specific stitching, seams, surface texture (matte/glossy), and material thickness exactly.

    2. **SCENE INTEGRATION**:
       - Base Scenario: "${scenarioPrompt}"
       ${customInstruction ? `- **USER SPECIFIC REQUEST (HIGHEST PRIORITY)**: "${customInstruction}". Adjust the model, environment, and composition to STRICTLY follow this instruction.` : ''}
       - Ensure lighting interacts naturally with the product's actual material (e.g., reflections on glass, shadow depth on fabric).

    ${isMulti ? `
    3. **MULTI-PRODUCT COMPOSITION**:
       - Include ALL distinct items provided in the source images.
       - Arrange them naturally (e.g., side-by-side or artistic stack) without overlapping key details.
    ` : ''}

    STRICT NEGATIVE CONSTRAINTS (DO NOT DO):
    - DO NOT change the product shape, color, or markings.
    - DO NOT add logos, text, or brand names that are not in the source image.
    - DO NOT add "standard features" (like rubber grips, reinforced heels, or extra buttons) if they are absent in the source.
    - STRICTLY NO copyrighted characters (Disney, Marvel, etc.) or third-party logos.
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