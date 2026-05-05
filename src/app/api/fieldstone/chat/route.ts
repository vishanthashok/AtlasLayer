import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
});

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Missing Anthropic API Key.' }, { status: 400 });
    }

    const { prompt, context } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const loc    = context?.locationName   ?? 'Unknown location';
    const rain   = context?.avgRainfall   != null ? Number(context.avgRainfall).toFixed(2)   : 'N/A';
    const temp   = context?.avgTemp       != null ? Number(context.avgTemp).toFixed(2)       : 'N/A';
    const soil   = context?.dominantSoil  ?? 'Unknown';
    const drought = context?.avgDroughtFreq != null ? Number(context.avgDroughtFreq).toFixed(2) : 'N/A';

    const systemPrompt = `You are Fieldstone, the PropertyVision agricultural intelligence module. You are analyzing a specific land parcel.
Parcel context:
- Location: ${loc}
- Avg Rainfall: ${rain} inches
- Avg Temp: ${temp} °F
- Soil Type: ${soil}
- Drought Frequency: ${drought} events/5yr

Answer the user's query analytically and concisely. Use bullet points when listing items. Max 150 words. No generic greetings. Be direct and data-driven.`;

    const msg = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 350,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }]
    });

    const textContent = msg.content[0].type === 'text' ? msg.content[0].text : 'No response generated.';

    return NextResponse.json({ response: textContent });

  } catch (error: any) {
    console.error("Fieldstone Chat error:", error);
    return NextResponse.json({ error: error.message || 'Failed to process query' }, { status: 500 });
  }
}
