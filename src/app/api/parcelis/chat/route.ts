import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(8000),
});

const BodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(40),
  context: z.record(z.string(), z.unknown()).optional(),
  model: z.string().max(80).optional().default('claude-sonnet-4-6'),
});

export async function POST(req: Request) {
  try {
    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.length < 10) {
      return NextResponse.json({ error: 'Missing or invalid ANTHROPIC_API_KEY.' }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
    }
    const { messages, context, model } = parsed.data;

    const systemPrompt = `You are Parcelis, the AtlasLayer assistant for real estate and architectural analysis.
You are helping a user analyze a specific property parcel.

CONTEXT:
${JSON.stringify(context)}

CRITICAL RULES:
1. ONLY return valid JSON. Do not use markdown blocks, no introductory text, no conversational filler.
2. Be extremely concise. Use short bullet points if necessary. Do not write long paragraphs.
3. If the user asks for a graph or visual data representation, populate the "graph" object. Otherwise, omit it.

JSON SCHEMA MUST EXACTLY MATCH THIS:
{
  "text": "Your concise answer goes here...",
  "graph": {
    "title": "Optional Graph Title",
    "type": "bar",
    "data": [{"name": "Label", "value": 100}],
    "xAxisKey": "name",
    "yAxisKey": "value"
  }
}`;

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await anthropic.messages.create({
      model,
      max_tokens: 500,
      temperature: 0.2,
      system: systemPrompt,
      messages,
    });

    const rawReply = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}';
    const cleanReply = rawReply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

    let parsedReply: { text: string; graph?: unknown };
    try {
      parsedReply = JSON.parse(cleanReply);
      if (!parsedReply.text) parsedReply = { text: 'Error: Received empty response.' };
    } catch {
      parsedReply = { text: cleanReply };
    }

    return NextResponse.json({ reply: JSON.stringify(parsedReply) });
  } catch (error: unknown) {
    console.error('Parcelis Chat Error:', error);
    const msg = error instanceof Error ? error.message : 'Chat failed';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
