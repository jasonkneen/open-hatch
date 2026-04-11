import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { messages, model, memory, documents } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please add your ANTHROPIC_API_KEY to Supabase secrets." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedModel = !model || model === "auto"
      ? "claude-opus-4-5"
      : model === "claude-opus-4-6"
      ? "claude-opus-4-5"
      : model === "claude-sonnet-4-6"
      ? "claude-sonnet-4-5"
      : model === "claude-haiku-4-5"
      ? "claude-haiku-4-5"
      : "claude-opus-4-5";

    let systemPrompt = "You are Hatch AI, an intelligent personal productivity assistant. Be concise, helpful, and thoughtful. Format responses clearly using markdown when appropriate.";

    if (memory) {
      systemPrompt += `\n\n<user_memory>\nThe following are persistent facts the user has saved about themselves. Use this context to personalize your responses:\n${memory}\n</user_memory>`;
    }

    if (documents) {
      systemPrompt += `\n\n<linked_documents>\nThe user has linked the following documents for context:\n${documents}\n</linked_documents>`;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-12-15",
      },
      body: JSON.stringify({
        model: resolvedModel,
        max_tokens: 4096,
        stream: true,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
        system: systemPrompt,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const transformStream = new TransformStream({
      transform(chunk, controller) {
        const text = new TextDecoder().decode(chunk);
        const lines = text.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === "content_block_delta" && parsed.delta?.type === "text_delta") {
                const out = JSON.stringify({ delta: { text: parsed.delta.text } });
                controller.enqueue(new TextEncoder().encode(`data: ${out}\n\n`));
              }
            } catch {}
          }
        }
      },
    });

    return new Response(response.body!.pipeThrough(transformStream), {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
