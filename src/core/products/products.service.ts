import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { chromium } from 'playwright';

type AnalysisInput = {
  skinType: string;
  concerns?: Array<{
    label: string;
    severity: 'Mild' | 'Moderate' | 'High';
    description: string;
  }>;
  morningRoutine?: Array<{ step: string; product: string; time: string }>;
  eveningRoutine?: Array<{ step: string; product: string; time: string }>;
};

type ScrapedProduct = {
  name: string;
  brand: string;
  price: string;
  image: string;
  url: string;
  benefits: string[];
  match: number;
  safeForAllergies?: boolean;
  hasConflicts?: boolean;
  conflictWarning?: string;
  keyIngredients?: string[];
  rating?: number;
};

@Injectable()
export class ProductsService {
  async getRecommendedProducts(
    analysis: AnalysisInput,
  ): Promise<ScrapedProduct[]> {
    console.log('Received analysis in ProductsService:', analysis);

    if (!analysis) {
      throw new BadRequestException('Analysis body is missing');
    }

    if (!analysis.skinType || typeof analysis.skinType !== 'string') {
      throw new BadRequestException('skinType is required');
    }

    const safeAnalysis: AnalysisInput = {
      skinType: analysis.skinType,
      concerns: Array.isArray(analysis.concerns) ? analysis.concerns : [],
      morningRoutine: Array.isArray(analysis.morningRoutine)
        ? analysis.morningRoutine
        : [],
      eveningRoutine: Array.isArray(analysis.eveningRoutine)
        ? analysis.eveningRoutine
        : [],
    };

    const queries = this.buildQueries(safeAnalysis);
    console.log('Generated product queries:', queries);

    let browser;

    try {
      browser = await chromium.launch({ headless: true });

      const page = await browser.newPage({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      });

      const allProducts: ScrapedProduct[] = [];

      for (const query of queries) {
        try {
          const searchUrl = `https://www.yesstyle.com/en/list.html?bpt=48&q=${encodeURIComponent(query)}`;
          console.log('Scraping URL:', searchUrl);

          await page.goto(searchUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 45000,
          });

          await page.waitForTimeout(3000);

          const pageText = await page.evaluate(
            () => document.body.innerText || '',
          );
          console.log(
            `PAGE TEXT SAMPLE FOR "${query}":`,
            pageText.slice(0, 1500),
          );

          const parsedProducts = this.parseYesStyleText(
            pageText,
            query,
            safeAnalysis,
          );

          console.log(
            `Parsed ${parsedProducts.length} products for query: ${query}`,
          );
          allProducts.push(...parsedProducts);
        } catch (queryError) {
          console.error(`Failed scraping query "${query}":`, queryError);
        }
      }

      const finalProducts = this.deduplicateAndSort(allProducts);
      console.log('Final deduplicated products count:', finalProducts.length);

      return finalProducts;
    } catch (error: any) {
      console.error('Products scraping failed:', error);

      if (error?.message?.includes("Executable doesn't exist")) {
        throw new InternalServerErrorException(
          'Playwright browser is not installed. Run: npx playwright install',
        );
      }

      throw new InternalServerErrorException(
        'Failed to fetch recommended products',
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  private buildQueries(analysis: AnalysisInput): string[] {
    const concerns = analysis.concerns || [];

    const concernQueries = concerns.map((concern) => {
      const label = concern.label.toLowerCase();

      if (
        label.includes('hyperpigmentation') ||
        label.includes('freckle') ||
        label.includes('tone') ||
        label.includes('dark')
      ) {
        return 'vitamin c serum';
      }

      if (label.includes('sun')) {
        return 'sunscreen spf 50';
      }

      if (label.includes('dehydration') || label.includes('dry')) {
        return 'hydrating moisturizer';
      }

      if (
        label.includes('acne') ||
        label.includes('oil') ||
        label.includes('pore')
      ) {
        return 'niacinamide serum';
      }

      return 'skincare serum';
    });

    const routineQueries = ['cleanser', 'serum', 'moisturizer', 'sunscreen'];

    return Array.from(new Set([...concernQueries, ...routineQueries])).slice(
      0,
      8,
    );
  }

  private parseYesStyleText(
    pageText: string,
    query: string,
    analysis: AnalysisInput,
  ): ScrapedProduct[] {
    const normalizedText = pageText.replace(/\r/g, '');

    const lines = normalizedText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const products: ScrapedProduct[] = [];

    for (let i = 0; i < lines.length - 1; i++) {
      const currentLine = lines[i];
      const nextLine = lines[i + 1];

      const productMatch = currentLine.match(/^(.*?)\s-\s(.*)$/);
      if (!productMatch) continue;

      const brand = productMatch[1]?.trim();
      const name = productMatch[2]?.trim();

      if (!brand || !name || name.length < 3) continue;

      if (
        name.toLowerCase().includes('bundle set') ||
        name.toLowerCase().includes('twin pack')
      ) {
        continue;
      }

      const priceMatch = nextLine.match(/US\$\s*([\d.]+)/i);
      if (!priceMatch) continue;

      const price = `US$ ${priceMatch[1]}`;
      const hasConflict = this.hasRoutineConflict(name, analysis);

      products.push({
        brand,
        name,
        price,
        image:
          'https://via.placeholder.com/400x400/8b63d3/ffffff?text=YesStyle+Product',
        url: `https://www.yesstyle.com/en/list.html?bpt=48&q=${encodeURIComponent(query)}`,
        benefits: this.guessBenefitsFromQuery(query, name),
        match: this.computeMatch(query, analysis, name),
        safeForAllergies: true,
        hasConflicts: hasConflict,
        conflictWarning: hasConflict
          ? 'May overlap with actives already present in your routine.'
          : undefined,
        keyIngredients: this.guessIngredients(name, query),
        rating: 4.5,
      });
    }

    console.log(`RAW MATCHED PRODUCTS FOR "${query}":`, products.slice(0, 5));

    return products.slice(0, 10);
  }

  private guessBenefitsFromQuery(query: string, name: string): string[] {
    const text = `${query} ${name}`.toLowerCase();
    const benefits: string[] = [];

    if (text.includes('vitamin c')) benefits.push('Brightening');
    if (text.includes('spf') || text.includes('sunscreen'))
      benefits.push('UV protection');
    if (text.includes('hydrating') || text.includes('moisturizer'))
      benefits.push('Hydration');
    if (text.includes('cleanser')) benefits.push('Cleansing');
    if (text.includes('niacinamide')) benefits.push('Oil balance');
    if (text.includes('pore')) benefits.push('Pore care');
    if (text.includes('serum')) benefits.push('Targeted treatment');

    return benefits.length > 0 ? benefits : ['Skin support'];
  }

  private guessIngredients(name: string, query: string): string[] {
    const text = `${name} ${query}`.toLowerCase();
    const ingredients: string[] = [];

    if (text.includes('vitamin c')) ingredients.push('Vitamin C');
    if (text.includes('niacinamide')) ingredients.push('Niacinamide');
    if (text.includes('spf') || text.includes('sunscreen'))
      ingredients.push('UV Filters');
    if (text.includes('hydrating') || text.includes('moisturizer'))
      ingredients.push('Humectants');
    if (text.includes('cleanser')) ingredients.push('Gentle Surfactants');

    return ingredients.length > 0 ? ingredients : ['See product details'];
  }

  private hasRoutineConflict(
    productName: string,
    analysis: AnalysisInput,
  ): boolean {
    const name = productName.toLowerCase();

    const routineProducts = [
      ...(analysis.morningRoutine || []).map((r) => r.product.toLowerCase()),
      ...(analysis.eveningRoutine || []).map((r) => r.product.toLowerCase()),
    ];

    const hasVitaminCInRoutine = routineProducts.some((p) =>
      p.includes('vitamin c'),
    );
    const hasRetinolInRoutine = routineProducts.some((p) =>
      p.includes('retinol'),
    );

    if (name.includes('retinol') && hasVitaminCInRoutine) return true;
    if (name.includes('vitamin c') && hasRetinolInRoutine) return true;

    return false;
  }

  private computeMatch(
    query: string,
    analysis: AnalysisInput,
    productName: string,
  ): number {
    let score = 78;

    const q = `${query} ${productName}`.toLowerCase();
    const skinType = analysis.skinType?.toLowerCase() || '';

    if (skinType.includes('combination') && q.includes('combination'))
      score += 8;
    if (skinType.includes('oily') && q.includes('oily')) score += 8;
    if (skinType.includes('dry') && q.includes('dry')) score += 8;
    if (skinType.includes('normal')) score += 4;

    for (const concern of analysis.concerns || []) {
      const concernLabel = concern.label.toLowerCase();

      if (
        q.includes(concernLabel) ||
        (concernLabel.includes('pore') && q.includes('niacinamide')) ||
        (concernLabel.includes('oil') && q.includes('niacinamide')) ||
        (concernLabel.includes('tone') && q.includes('vitamin c')) ||
        (concernLabel.includes('freckle') && q.includes('vitamin c')) ||
        (concernLabel.includes('hyperpigmentation') &&
          q.includes('vitamin c')) ||
        (concernLabel.includes('sun') && q.includes('sunscreen'))
      ) {
        if (concern.severity === 'High') score += 12;
        else if (concern.severity === 'Moderate') score += 9;
        else score += 6;
      }
    }

    if (this.hasRoutineConflict(productName, analysis)) {
      score -= 8;
    }

    return Math.max(70, Math.min(score, 98));
  }

  private deduplicateAndSort(products: ScrapedProduct[]): ScrapedProduct[] {
    const seen = new Set<string>();
    const unique: ScrapedProduct[] = [];

    for (const product of products) {
      const name = (product.name || '').toLowerCase().trim();
      const brand = (product.brand || '').toLowerCase().trim();
      const key = `${name}|${brand}`;

      if (!name || !product.url) continue;

      if (!seen.has(key)) {
        seen.add(key);
        unique.push(product);
      }
    }

    return unique.sort((a, b) => b.match - a.match).slice(0, 12);
  }
}
