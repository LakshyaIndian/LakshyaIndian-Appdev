import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const getAI = () => {
  // Use the selected API key if available, otherwise fallback to the default GEMINI_API_KEY
  const apiKey = process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API key is missing. Please select one or add it to your Secrets in AI Studio.");
  }
  return new GoogleGenAI({ apiKey });
};

export const analyzeTranscript = async (input: { text?: string; pdfBase64?: string }) => {
  const ai = getAI();
  
  const promptPart = {
    text: `
      Analyze the following stock earnings call transcript and provide a debate between two personas: a "Bull" (optimistic) and a "Bear" (pessimistic).
      
      If you are provided with a PDF, please extract the most important text and include it in the "extractedText" field of the JSON response.
      
      Format the response as JSON with the following structure:
      {
        "summary": "A brief summary highlighting key points and overall subject matter (approx 2-3 paragraphs).",
        "bull": "Exactly 5 crisp, bulleted points providing optimistic arguments. Each point must include specific context from the transcript.",
        "bear": "Exactly 5 crisp, bulleted points providing pessimistic arguments. Each point must include specific context from the transcript.",
        "sentimentPrompt": "A short, descriptive prompt for an image generator to create a high-quality sentiment dial/gauge reflecting the overall tone. Example: 'A high-tech financial dial pointing towards extreme greed, neon green accents, 4k, professional UI'.",
        "extractedText": "The full or summarized text extracted from the document (if a PDF was provided)."
      }
    `
  };

  const parts: any[] = [promptPart];

  if (input.pdfBase64) {
    parts.push({
      inlineData: {
        data: input.pdfBase64,
        mimeType: "application/pdf"
      }
    });
  } else if (input.text) {
    parts.push({
      text: `Transcript Content:\n${input.text.substring(0, 30000)}`
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts },
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("No response text from Gemini.");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(error.message || "Failed to analyze transcript with Gemini.");
  }
};

export const generateSentimentGauge = async (prompt: string) => {
  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: {
        parts: [
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
          imageSize: "1K"
        },
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    return null; // Non-critical, just return null
  }
};

export const chatWithPersonas = async (transcript: string, question: string, history: { role: string, content: string }[]) => {
  const ai = getAI();
  const prompt = `
    You are a debate panel for a stock analysis. 
    Transcript context: ${transcript.substring(0, 10000)}
    
    The user asks: "${question}"
    
    Provide two separate responses:
    1. From the Bull's perspective (optimistic).
    2. From the Bear's perspective (pessimistic).
    
    Format the response as JSON:
    {
      "bull": "Bull's response...",
      "bear": "Bear's response..."
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    if (!response.text) {
      throw new Error("No response text from Gemini.");
    }

    return JSON.parse(response.text);
  } catch (error: any) {
    console.error("Gemini Chat Error:", error);
    throw new Error(error.message || "Failed to get response from Gemini.");
  }
};
