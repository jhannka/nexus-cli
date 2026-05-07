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
}
