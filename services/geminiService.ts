
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
      
      const isRateLimit = 
        error?.status === 429 || 
        error?.code === 429 || 
        error?.status === 'RESOURCE_EXHAUSTED' ||
        (error?.message && error.message.toLowerCase().includes('quota'));
      
      if (isRateLimit && i < retries - 1) {
        const backoff = Math.min(initialDelay * Math.pow(2, i), 10000);
        console.warn(`Rate limit hit. Retrying in ${backoff/1000}s...`);
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
    作为亚马逊产品视觉专家，请分析这些产品图片。
    
    任务：
    1. 识别产品名称/类型（中文）。${isMulti ? '这是一组产品（套装或系列），请将它们作为一个整体识别。' : ''}
    2. 用中文写一段简短的视觉描述。
    3. 列出3个适合在图片中展示的关键卖点（中文）。
    4. **技术设计规范分析（关键）**：
       - 列出4-6个具体的产品视觉特征（使用中文专业术语，如“无缝工艺”、“磨砂质感”）。
       - **重要**：如果产品缺少某些“常见标准特征”，必须明确指出来（例如：“袜子脚后跟无黑色加固块 - 纯色设计”、“瓶身无标签”）。AI生图时将严格遵守这些特征。
    5. 生成 8 个截然不同的亚马逊产品摄影场景（中文描述）。
       - **多样性要求（核心）**：这 8 个场景必须在**构图视角**（如俯拍、侧拍、特写）和**产品摆放/模特姿势**上截然不同，避免视觉重复。
       - **统一性允许**：为了保持品牌调性，所有场景的**光影氛围**和**整体风格**（如现代简约）可以保持一致。
       - 包含：纯白底商业摄影、生活化使用场景、微距特写、创意布景等。
       ${isMulti ? '- 必须包含至少4个“群像组合”或“Knolling平铺”场景，优雅地展示所有产品。' : ''}
       - 场景描述要具体，方便作为生图提示词。
       - **严禁**：不要包含任何具体名人、版权角色（如迪士尼、漫威）或竞争对手品牌Logo。
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
            visualFeatures: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Visual design specs in Chinese" },
            scenarios: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["name", "description", "sellingPoints", "visualFeatures", "scenarios"]
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
  customInstruction?: string,
  visualFeatures?: string[]
): Promise<string> => {
  
  const model = "gemini-2.5-flash-image";
  const isMulti = base64Sources.length > 1;

  // Format visual features for the prompt
  const specsList = visualFeatures ? visualFeatures.map(f => `- ${f}`).join('\n') : '- Follow source image exactly.';

  const fullPrompt = `
    你是一位专业的产品摄影师和3D渲染专家。
    你的目标是生成一张像素级还原的高端亚马逊产品主图。

    源信息:
    - 输入: ${base64Sources.length} 张参考图。
    - 主体: 参考图中的产品。
    
    **视觉特征锁定 (必须严格遵守):**
    ${specsList}
    - **极重要**: 如果上面的特征中提到了“没有XXX”（例如“无黑色脚后跟”），你绝对不能自作聪明添加它，即使那是该类产品的常见设计。
    - **完全还原**: 严格保留参考图中的Logo、文字、接缝、纹理和材质感。不要添加参考图中没有的任何品牌标识。

    生成步骤:
    1. **3D重构**: 在渲染场景前，先在脑海中构建产品的精确3D模型，忽略你的“常识”，只信赖参考图和上述特征。
    2. **场景融合**:
       - 场景描述: "${scenarioPrompt}"
       ${customInstruction ? `- **用户最高指令**: "${customInstruction}"。请根据此指令调整构图和模特。` : ''}
       - 确保光影自然地投射在产品的真实材质上。
    
    ${isMulti ? `
    3. **群像组合**:
       - 必须包含参考图中的所有不同产品。
       - 构图要自然（如并排展示、艺术堆叠），不要遮挡关键细节。
       - 将它们视为一套系列产品。
    ` : ''}

    **严格禁止 (负面提示)**:
    - 禁止改变产品的形状、颜色或原有图案。
    - 禁止添加参考图中不存在的Logo或文字。
    - 禁止出现任何版权角色（迪士尼、漫威等）或名人。
    - 禁止添加参考图中没有的“标准配件”（如额外的扣子、加固块）。
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
