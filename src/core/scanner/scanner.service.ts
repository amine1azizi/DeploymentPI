import {
  BadRequestException,
  Injectable,
  NotFoundException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GoogleGenerativeAI } from '@google/generative-ai';

type ScannerIngredientStatus = 'beneficial' | 'neutral' | 'problematic';
type ScannerCompatibility = 'excellent' | 'good' | 'caution' | 'avoid';

type ScannerResult = {
  barcode: string;
  name: string;
  brand: string;
  image: string;
  compatibility: ScannerCompatibility;
  compatibilityScore: number;
  ingredients: {
    name: string;
    status: ScannerIngredientStatus;
    description: string;
  }[];
  layeringOrder: number;
  conflictsWith: string[];
  recommendations: string[];
};

@Injectable()
export class ScannerService {
  private genAI: GoogleGenerativeAI;

  constructor(private readonly prisma: PrismaService) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not defined in .env');
    }

    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyzeProductForUser(
    keycloakId: string,
    query: string,
  ): Promise<ScannerResult> {
    const skinProfile = await this.getLatestSkinProfile(keycloakId);

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      const prompt = `
You are a skincare cosmetic compatibility assistant.

Analyze a skincare/cosmetic product against this user's latest skin profile.

USER SKIN PROFILE:
${JSON.stringify(skinProfile, null, 2)}

PRODUCT QUERY:
"${query}"

Rules:
- The query can be product name, barcode, or partial text.
- If uncertain, be conservative.
- If exact ingredients are unknown, infer cautiously from common formulations.
- Return valid JSON only.
- No markdown.
- No explanation outside JSON.

Return exactly:
{
  "barcode": "string",
  "name": "string",
  "brand": "string",
  "image": "string",
  "compatibility": "excellent|good|caution|avoid",
  "compatibilityScore": number,
  "ingredients": [
    {
      "name": "string",
      "status": "beneficial|neutral|problematic",
      "description": "string"
    }
  ],
  "layeringOrder": number,
  "conflictsWith": ["string"],
  "recommendations": ["string"]
}

Layering order:
1 = cleanser
2 = toner/essence/watery serum
3 = treatment serum
4 = moisturizer/cream
5 = sunscreen
0 = not recommended

If image unknown, return empty string for image.
`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      const cleanJson = text.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);

      return this.normalizeScannerResult(parsed, query);
    } catch (error: any) {
      console.error('Scanner text AI error:', error);

      throw new HttpException(
        {
          message: 'Failed to analyze product',
          details: error?.message || 'Unknown scanner error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async analyzeProductImageForUser(
    keycloakId: string,
    fileBuffer: Buffer,
    mimeType: string,
  ): Promise<ScannerResult> {
    const skinProfile = await this.getLatestSkinProfile(keycloakId);

    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty product image buffer');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
      });

      const prompt = `
You are a skincare cosmetic compatibility assistant.

A user uploaded a PHOTO of a skincare/cosmetic product.
Your job:
1. Identify the product as best as possible from the image.
2. Infer likely category/brand/name if visible.
3. If ingredients are visible or partially visible, use them.
4. If not fully visible, make a cautious best-effort estimate.
5. Analyze compatibility using the user's latest skin profile.

USER SKIN PROFILE:
${JSON.stringify(skinProfile, null, 2)}

Rules:
- Be conservative when uncertain.
- Never act overly certain if the image is blurry or incomplete.
- Return valid JSON only.
- No markdown.
- No explanation outside JSON.

Return exactly:
{
  "barcode": "string",
  "name": "string",
  "brand": "string",
  "image": "string",
  "compatibility": "excellent|good|caution|avoid",
  "compatibilityScore": number,
  "ingredients": [
    {
      "name": "string",
      "status": "beneficial|neutral|problematic",
      "description": "string"
    }
  ],
  "layeringOrder": number,
  "conflictsWith": ["string"],
  "recommendations": ["string"]
}

Layering order:
1 = cleanser
2 = toner/essence/watery serum
3 = treatment serum
4 = moisturizer/cream
5 = sunscreen
0 = not recommended

If barcode not visible, return "".
If image URL unknown, return "".
`;

      const imagePart = {
        inlineData: {
          data: fileBuffer.toString('base64'),
          mimeType,
        },
      };

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const text = response.text();

      const cleanJson = text.replace(/```json|```/gi, '').trim();
      const parsed = JSON.parse(cleanJson);

      return this.normalizeScannerResult(parsed, 'uploaded-product-image');
    } catch (error: any) {
      console.error('Scanner image AI error:', error);

      throw new HttpException(
        {
          message: 'Failed to analyze product image',
          details: error?.message || 'Unknown scanner image error',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async getLatestSkinProfile(keycloakId: string) {
    if (!keycloakId) {
      throw new BadRequestException('Missing authenticated user id');
    }

    const user = await this.prisma.user.findUnique({
      where: { keycloakId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const latestAnalysis = await this.prisma.analysis.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestAnalysis) {
      throw new NotFoundException(
        'No previous skin analysis found. Please analyze your skin first.',
      );
    }

    return {
      skinType: latestAnalysis.skinType,
      healthScore: latestAnalysis.healthScore,
      skinAge: latestAnalysis.skinAge,
      summary: latestAnalysis.summary,
      concerns: latestAnalysis.concerns,
      morningRoutine: latestAnalysis.morningRoutine,
      eveningRoutine: latestAnalysis.eveningRoutine,
    };
  }

  private normalizeScannerResult(data: any, fallback: string): ScannerResult {
    const compatibility: ScannerCompatibility = [
      'excellent',
      'good',
      'caution',
      'avoid',
    ].includes(data?.compatibility)
      ? data.compatibility
      : 'caution';

    const ingredients = Array.isArray(data?.ingredients)
      ? data.ingredients.map((item: any) => ({
          name: String(item?.name || 'Unknown ingredient'),
          status: this.normalizeIngredientStatus(item?.status),
          description: String(item?.description || ''),
        }))
      : [];

    return {
      barcode: String(data?.barcode || ''),
      name: String(data?.name || fallback || 'Unknown product'),
      brand: String(data?.brand || 'Unknown brand'),
      image: String(data?.image || ''),
      compatibility,
      compatibilityScore: Math.max(
        0,
        Math.min(100, Number(data?.compatibilityScore ?? 50)),
      ),
      ingredients,
      layeringOrder: Number.isFinite(Number(data?.layeringOrder))
        ? Number(data.layeringOrder)
        : 0,
      conflictsWith: Array.isArray(data?.conflictsWith)
        ? data.conflictsWith.map((x: any) => String(x))
        : [],
      recommendations: Array.isArray(data?.recommendations)
        ? data.recommendations.map((x: any) => String(x))
        : [],
    };
  }

  private normalizeIngredientStatus(status: any): ScannerIngredientStatus {
    if (status === 'beneficial') return 'beneficial';
    if (status === 'problematic') return 'problematic';
    return 'neutral';
  }
}
