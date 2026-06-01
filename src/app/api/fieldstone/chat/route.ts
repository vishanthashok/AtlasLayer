import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const BodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  context: z.object({
    locationName: z.string().optional(),
    avgRainfall: z.number().optional(),
    avgTemp: z.number().optional(),
    dominantSoil: z.string().optional(),
    avgDroughtFreq: z.number().optional(),
  }).optional(),
});

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'Missing Anthropic API Key.' }, { status: 400 });
    }

    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    const { prompt, context } = parsed.data;

    const loc     = context?.locationName ?? 'Unknown location';
    const rain    = context?.avgRainfall   != null ? context.avgRainfall.toFixed(2)   : 'N/A';
    const temp    = context?.avgTemp       != null ? context.avgTemp.toFixed(2)       : 'N/A';
    const soil    = context?.dominantSoil  ?? 'Unknown';
    const drought = context?.avgDroughtFreq != null ? context.avgDroughtFreq.toFixed(2) : 'N/A';

    const systemPrompt = `You are Fieldstone, the AtlasLayer agricultural intelligence module. You are analyzing a specific land parcel.
Parcel context:
- Location: ${loc}
- Avg Rainfall: ${rain} inches
- Avg Temp: ${temp} °F
- Soil Type: ${soil}
- Drought Frequency: ${drought} events/5yr

Answer the user's query analytically and concisely. Use bullet points when listing items. Max 150 words. No generic greetings. Be direct and data-driven.`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 350,
      temperature: 0.3,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    const textContent = msg.content[0].type === 'text' ? msg.content[0].text : 'No response generated.';
    return NextResponse.json({ response: textContent });
  } catch (error: unknown) {
    console.error('Fieldstone Chat error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to process query';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
