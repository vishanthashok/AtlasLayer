import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });

export async function POST(req: Request) {
  try {
    const { messages, context, model } = await req.json();

    if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY.length < 10) {
      return NextResponse.json({ error: "Missing or invalid ANTHROPIC_API_KEY. Please check your environment variables." }, { status: 401 });
    }

    const systemPrompt = `You are Parcelis, the PropertyVision assistant for real estate and architectural analysis.
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
  } // Include ONLY if asked for a visual/graph
}`;

    const response = await anthropic.messages.create({
      model: model || 'claude-sonnet-4-6',
      max_tokens: 500, // Reduced from 1000 to save API credits
      temperature: 0.2, // Lower temperature for more structured, deterministic JSON
      system: systemPrompt,
      messages: messages.map((m: any) => ({
        role: m.role,
        content: m.content
      }))
    });

    const rawReply = response.content[0].type === 'text' ? response.content[0].text.trim() : "{}";
    const cleanReply = rawReply.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    
    let parsedReply;
    try {
      parsedReply = JSON.parse(cleanReply);
      // Ensure 'text' exists at minimum
      if (!parsedReply.text) {
        parsedReply = { text: "Error: Received empty response." };
      }
    } catch (e) {
      console.error("Failed to parse JSON from AI", cleanReply);
      parsedReply = { text: cleanReply }; // Fallback to raw text if JSON parsing fails
    }

    return NextResponse.json({ reply: JSON.stringify(parsedReply) });
  } catch (error: any) {
    console.error('Parcelis Chat Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
