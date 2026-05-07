import Anthropic from '@anthropic-ai/sdk';

export class AIProvider {
  constructor(provider, apiKey, model) {
    this.provider = provider;
    this.apiKey = apiKey;
    this.model = model;
  }

  async analyze(prompt, options = {}) {
    if (this.provider === 'anthropic') {
      return this.analyzeWithAnthropic(prompt, options);
    } else if (this.provider === 'openai') {
      return this.analyzeWithOpenAI(prompt, options);
    } else if (this.provider === 'gemini') {
      return this.analyzeWithGemini(prompt, options);
    }
    throw new Error(`Unknown provider: ${this.provider}`);
  }

  async analyzeWithAnthropic(prompt, options = {}) {
    const client = new Anthropic({ apiKey: this.apiKey });
    const message = await client.messages.create({
      model: this.model,
      max_tokens: options.maxTokens || 1024,
      messages: [{ role: 'user', content: prompt }]
    });
    return message.content[0]?.text || '';
  }

  async analyzeWithOpenAI(prompt, options = {}) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: this.apiKey });
      const message = await openai.chat.completions.create({
        model: this.model,
        max_tokens: options.maxTokens || 1024,
        messages: [{ role: 'user', content: prompt }]
      });
      return message.choices[0]?.message?.content || '';
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('OpenAI SDK not installed. Run: npm install openai');
      }
      throw err;
    }
  }

  async analyzeWithGemini(prompt, options = {}) {
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: this.model });
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Google Gemini SDK not installed. Run: npm install @google/generative-ai');
      }
      throw err;
    }
  }

  /**
   * Analyze with a tool/function call. Returns parsed JSON object matching toolSchema.
   * Anthropic uses native tool_use. OpenAI uses function calling. Gemini falls back to JSON-in-text.
   */
  async analyzeWithTool({ systemPrompt, userContent, toolName, toolSchema, maxTokens = 4096 }) {
    if (this.provider === 'anthropic') {
      const client = new Anthropic({ apiKey: this.apiKey });
      const response = await client.messages.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature: 0,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
        tools: [{ name: toolName, description: `Submit findings`, input_schema: toolSchema }],
        tool_choice: { type: 'tool', name: toolName }
      });
      const toolUse = response.content.find(c => c.type === 'tool_use');
      if (!toolUse) return { findings: [] };
      return toolUse.input;
    }

    if (this.provider === 'openai') {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: this.apiKey });
      const response = await openai.chat.completions.create({
        model: this.model,
        max_tokens: maxTokens,
        temperature: 0,
        seed: 42,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        tools: [{ type: 'function', function: { name: toolName, description: 'Submit findings', parameters: toolSchema } }],
        tool_choice: { type: 'function', function: { name: toolName } }
      });
      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) return { findings: [] };
      try { return JSON.parse(toolCall.function.arguments); } catch { return { findings: [] }; }
    }

    if (this.provider === 'gemini') {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({
        model: this.model,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0
        }
      });
      const fullPrompt = `${systemPrompt}\n\n${userContent}\n\nReturn ONLY JSON matching this schema (no markdown, no commentary):\n${JSON.stringify(toolSchema, null, 2)}`;
      const result = await model.generateContent(fullPrompt);
      const text = result.response.text();
      try { return JSON.parse(text); } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) { try { return JSON.parse(match[0]); } catch {} }
        return { findings: [] };
      }
    }

    throw new Error(`Unknown provider: ${this.provider}`);
  }
}
