import {
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

type GeminiRetryInfoDetail = {
  '@type'?: string;
  retryDelay?: string;
};

@Injectable()
export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;

    console.log('Initializing GeminiService...');
    console.log('GEMINI_API_KEY exists:', !!apiKey);

    if (!apiKey) {
      console.error('GEMINI_API_KEY is missing in environment variables');
      throw new InternalServerErrorException(
        'GEMINI_API_KEY is not defined. Please add it to your .env file.',
      );
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
    console.log('GeminiService initialized successfully');
  }

  async analyzeImage(fileBuffer: Buffer, mimeType: string) {
    console.log('--- analyzeImage started ---');
    console.log('Mime type:', mimeType);
    console.log('Buffer size:', fileBuffer?.length || 0);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new HttpException(
        { message: 'Empty image buffer received' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      const prompt = `
Analyze this human face for skincare purposes.

Return ONLY a valid raw JSON object with this exact structure:
{
  "skinType": "string",
  "healthScore": number,
  "skinAge": number,
  "summary": "string",
  "concerns": [
    {
      "label": "string",
      "severity": "Mild | Moderate | High",
      "description": "string",
      "tips": ["string", "string", "string"],
      "riskLevel": {
        "level": "low | medium | high",
        "label": "Low Risk | Medium Risk | High Risk",
        "color": "string",
        "bgColor": "string"
      },
      "icon": "Droplets | Sun | AlertCircle | Sparkles | Zap | AlertTriangle | Shield | Activity",
      "color": "string"
    }
  ],
  "morningRoutine": [
    {
      "step": "string",
      "product": "string",
      "time": "Morning",
      "purpose": "string",
      "howToUse": "string",
      "frequency": "string",
      "priority": "high | medium | low"
    }
  ],
  "eveningRoutine": [
    {
      "step": "string",
      "product": "string",
      "time": "Evening",
      "purpose": "string",
      "howToUse": "string",
      "frequency": "string",
      "priority": "high | medium | low"
    }
  ]
}

Rules:
- Return only valid JSON
- Do not add markdown
- Do not add explanation text
- Do not wrap the JSON in triple backticks
- concerns must be fully AI-generated
- Every concern must include:
  label, severity, description, tips, riskLevel, icon, color
- tips must contain 3 to 5 useful and specific skincare recommendations
- Do not leave tips empty
- Every routine step must include:
  step, product, time, purpose, howToUse, frequency, priority
- priority must be one of: high, medium, low
- howToUse must be short and practical
- purpose must explain why the step is important
- Allowed icon values only:
  Droplets, Sun, AlertCircle, Sparkles, Zap, AlertTriangle, Shield, Activity
- Allowed Tailwind-like text color examples:
  text-blue-500, text-yellow-500, text-orange-500, text-purple-500, text-red-500, text-emerald-500
- Allowed Tailwind-like bg color examples:
  bg-blue-50, bg-yellow-50, bg-orange-50, bg-purple-50, bg-red-50, bg-emerald-50
`;

      const imagePart = {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType,
        },
      };

      console.log('Sending request to Gemini...');

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      console.log('Gemini raw response:');
      console.log(text);

      const cleanJson = text.replace(/```json|```/gi, '').trim();

      console.log('Cleaned Gemini response:');
      console.log(cleanJson);

      try {
        const parsed = JSON.parse(cleanJson);
        console.log('JSON parsed successfully');

        const normalized = this.normalizeAnalysis(parsed);
        console.log('Normalized Gemini response:');
        console.log(JSON.stringify(normalized, null, 2));

        return normalized;
      } catch (parseError: any) {
        console.error('JSON parse failed:', parseError?.message || parseError);

        throw new HttpException(
          {
            message: 'Gemini returned invalid JSON',
            rawResponse: text,
            parseError: parseError?.message || 'Unknown parse error',
          },
          HttpStatus.BAD_GATEWAY,
        );
      }
    } catch (error: any) {
      console.error('Gemini Analysis Error:', error);

      if (error instanceof HttpException) {
        throw error;
      }

      const status = typeof error?.status === 'number' ? error.status : null;
      const retryAfterMs = this.extractRetryAfterMs(error);

      if (status === 429) {
        throw new HttpException(
          {
            code: 'AI_QUOTA_EXCEEDED',
            message: 'AI quota exceeded. Please retry shortly.',
            retryAfterMs: retryAfterMs ?? 60000,
            details: error?.message || 'Gemini rate limit exceeded',
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      if (status === 400) {
        throw new HttpException(
          {
            code: 'AI_BAD_REQUEST',
            message: 'Gemini rejected the request.',
            details: error?.message || 'Bad request sent to Gemini',
          },
          HttpStatus.BAD_REQUEST,
        );
      }

      throw new HttpException(
        {
          code: 'AI_ANALYSIS_FAILED',
          message: 'Failed to analyze image with AI',
          details: error?.message || 'Unknown Gemini error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private normalizeAnalysis(parsed: any) {
    return {
      skinType: parsed?.skinType || 'Unknown',
      healthScore:
        typeof parsed?.healthScore === 'number' ? parsed.healthScore : 0,
      skinAge: typeof parsed?.skinAge === 'number' ? parsed.skinAge : 0,
      summary: parsed?.summary || 'No summary provided.',
      concerns: Array.isArray(parsed?.concerns)
        ? parsed.concerns.map((concern: any) => this.normalizeConcern(concern))
        : [],
      morningRoutine: Array.isArray(parsed?.morningRoutine)
        ? parsed.morningRoutine.map((step: any) =>
            this.normalizeRoutineStep(step, 'Morning'),
          )
        : [],
      eveningRoutine: Array.isArray(parsed?.eveningRoutine)
        ? parsed.eveningRoutine.map((step: any) =>
            this.normalizeRoutineStep(step, 'Evening'),
          )
        : [],
    };
  }

  private normalizeConcern(concern: any) {
    const label = concern?.label || 'Unknown Concern';
    const severity = this.normalizeSeverity(concern?.severity);
    const description =
      concern?.description || 'No description provided for this concern.';

    const tips =
      Array.isArray(concern?.tips) &&
      concern.tips.filter(
        (tip: any) => typeof tip === 'string' && tip.trim() !== '',
      ).length > 0
        ? concern.tips.filter(
            (tip: any) => typeof tip === 'string' && tip.trim() !== '',
          )
        : ['No specific tips provided.'];
    return {
      label,
      severity,
      description,
      tips,
      riskLevel: this.normalizeRiskLevel(concern?.riskLevel, severity),
      icon: this.normalizeIcon(concern?.icon),
      color: this.normalizeColor(concern?.color, label),
    };
  }

  private normalizeRoutineStep(step: any, defaultTime: 'Morning' | 'Evening') {
    return {
      step: step?.step || 'Skincare Step',
      product: step?.product || 'Recommended Product',
      time: step?.time || defaultTime,
      purpose: step?.purpose || 'Supports overall skin health.',
      howToUse:
        step?.howToUse || 'Apply gently as part of your skincare routine.',
      frequency: step?.frequency || 'Daily',
      priority: this.normalizePriority(step?.priority),
    };
  }

  private normalizePriority(priority: any): 'high' | 'medium' | 'low' {
    const value = String(priority || '').toLowerCase();

    if (value === 'high') return 'high';
    if (value === 'low') return 'low';
    return 'medium';
  }

  private normalizeSeverity(value: any): 'Mild' | 'Moderate' | 'High' {
    const severity = String(value || '').toLowerCase();

    if (severity.includes('high')) return 'High';
    if (severity.includes('moderate') || severity.includes('medium')) {
      return 'Moderate';
    }

    return 'Mild';
  }

  private normalizeRiskLevel(
    riskLevel: any,
    severity: 'Mild' | 'Moderate' | 'High',
  ) {
    if (
      riskLevel &&
      typeof riskLevel === 'object' &&
      riskLevel.level &&
      riskLevel.label &&
      riskLevel.color &&
      riskLevel.bgColor
    ) {
      return riskLevel;
    }

    if (severity === 'High') {
      return {
        level: 'high',
        label: 'High Risk',
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      };
    }

    if (severity === 'Moderate') {
      return {
        level: 'medium',
        label: 'Medium Risk',
        color: 'text-orange-600',
        bgColor: 'bg-orange-50',
      };
    }

    return {
      level: 'low',
      label: 'Low Risk',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    };
  }

  private normalizeIcon(icon: any): string {
    const allowedIcons = [
      'Droplets',
      'Sun',
      'AlertCircle',
      'Sparkles',
      'Zap',
      'AlertTriangle',
      'Shield',
      'Activity',
    ];

    if (typeof icon === 'string' && allowedIcons.includes(icon)) {
      return icon;
    }

    return 'Sparkles';
  }

  private normalizeColor(color: any, label: string): string {
    if (typeof color === 'string' && color.trim() !== '') {
      return color;
    }

    const normalized = label.toLowerCase();

    if (
      normalized.includes('dehydration') ||
      normalized.includes('dry') ||
      normalized.includes('hydration')
    ) {
      return 'text-blue-500';
    }

    if (normalized.includes('sun') || normalized.includes('uv')) {
      return 'text-yellow-500';
    }

    if (
      normalized.includes('spot') ||
      normalized.includes('pigment') ||
      normalized.includes('dark')
    ) {
      return 'text-orange-500';
    }

    if (
      normalized.includes('acne') ||
      normalized.includes('pimple') ||
      normalized.includes('breakout')
    ) {
      return 'text-purple-500';
    }

    return 'text-[#8b63d3]';
  }

  private extractRetryAfterMs(error: any): number | null {
    const details = error?.errorDetails;

    if (!Array.isArray(details)) {
      return null;
    }

    const retryInfo = details.find(
      (detail: GeminiRetryInfoDetail) =>
        detail?.['@type'] === 'type.googleapis.com/google.rpc.RetryInfo',
    );

    const retryDelay = retryInfo?.retryDelay;

    if (typeof retryDelay !== 'string' || !retryDelay.endsWith('s')) {
      return null;
    }

    const seconds = Number.parseFloat(retryDelay.slice(0, -1));
    if (Number.isNaN(seconds)) {
      return null;
    }

    return Math.ceil(seconds * 1000);
  }
  async generateTextResponse(prompt: string): Promise<string> {
    console.log('--- generateTextResponse started ---');
    console.log('Prompt length:', prompt.length);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      console.log('Sending text request to Gemini...');

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      console.log('Gemini text response received');
      return text.trim();
    } catch (error: any) {
      console.error('Gemini Text Generation Error:', error);

      throw new HttpException(
        {
          message: 'Failed to generate text response with AI',
          details: error?.message || 'Unknown Gemini error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
