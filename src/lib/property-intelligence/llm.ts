import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

/**
 * Generates Quant JSON using Claude (default) or Gemini when model name / env requests it.
 */
export async function generateQuantAnalysisJson(
  requestedModel: string,
  system: string,
  user: string
): Promise<string> {
  const wantsGemini =
    requestedModel.toLowerCase().includes('gemini') ||
    requestedModel.startsWith('models/');
  const googleKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

  if (wantsGemini && googleKey) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(googleKey);
    const modelName = requestedModel.includes('gemini')
      ? requestedModel
      : 'gemini-1.5-flash';
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 8192,
        responseMimeType: 'application/json',
      },
      systemInstruction: system,
    });
    const result = await model.generateContent(user);
    const text = result.response.text();
    return text.trim();
  }

  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.length < 10) {
    throw new Error('Missing AI API Key (ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY).');
  }

  const msg = await anthropic.messages.create({
    model: requestedModel,
    max_tokens: 8192,
    temperature: 0,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const raw = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : '{}';
  return raw;
}
