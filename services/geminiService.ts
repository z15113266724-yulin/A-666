import { GoogleGenAI, Type } from "@google/genai";
import { ProductAnalysis, AspectRatio } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes the uploaded product image to understand what it is
 * and generate potential photography scenarios.
 */
export const analyzeProductImage = async (base64Image: string): Promise<ProductAnalysis> => {
  const prompt = `
    Analyze this product image for an Amazon listing. 
    1. Identify the product name/type.
    2. Write a short visual description.
    3. List 3 key selling points visualizable in a photo.
    4. Generate exactly 8 distinct photography scenarios suitable for Amazon.
       - Include: White background studio shot, Lifestyle usage shot, Close-up detail shot, In-context environment shot.
       - Make the scenarios descriptive prompt fragments (e.g., "placed on a modern marble kitchen counter with sunlight").
  `;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64Image } },
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
};

/**
 * Generates a single image based on the original product and a specific scenario.
 */
export const generateScenarioImage = async (
  base64Source: string,
  scenarioPrompt: string,
  ratio: AspectRatio
): Promise<string> => {
  
  // Use gemini-2.5-flash-image for standard generation (free tier compatible, no special auth required)
  const model = "gemini-2.5-flash-image";
  
  const fullPrompt = `
    Create a professional, high-quality product photography image.
    Subject: The product in the reference image.
    Scenario: ${scenarioPrompt}.
    Requirements:
    - Keep the product looking EXACTLY like the reference image (colors, branding, shape).
    - Professional lighting and composition.
    - Photorealistic.
    - No text overlays.
  `;

  const response = await ai.models.generateContent({
    model: model,
    contents: {
      parts: [
        { text: fullPrompt },
        { inlineData: { mimeType: "image/jpeg", data: base64Source } } // Pass source image for consistency
      ]
    },
    config: {
      imageConfig: {
        aspectRatio: ratio,
        // imageSize is not supported in gemini-2.5-flash-image
      }
    }
  });

  // Extract image
  // The response usually contains the image in the parts
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
};