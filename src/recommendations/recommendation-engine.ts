import {
  RecommendationRequest,
  RecommendationResult,
  Recommendation,
  RecommendationStrategy,
  RecommendationFeedback,
  TrendingContent,
  ContentType,
  Difficulty,
} from '../types';
import { CacheManager } from '../caching/cache-manager';
import { Logger } from '../utilities/logger';

export class RecommendationEngine {
  private logger: Logger;
  private cache: CacheManager;
  private feedbackLog: Map<string, RecommendationFeedback[]>;

  constructor(logger?: Logger) {
    this.logger = logger ?? new Logger({ prefix: '[RecommendationEngine]' });
    this.cache = new CacheManager({ defaultTTL: 60 * 60 * 1000 });
    this.feedbackLog = new Map();
  }

  async getRecommendations(request: RecommendationRequest): Promise<RecommendationResult> {
    const cacheKey = `rec:${request.studentId}:${JSON.stringify(request.context)}`;
    const cached = this.cache.get<RecommendationResult>(cacheKey);
    if (cached) return cached;

    const recommendations = await this.generateRecommendations(request);
    const result: RecommendationResult = {
      recommendations,
      total: recommendations.length,
      strategy: RecommendationStrategy.HYBRID,
      personalized: true,
    };

    this.cache.set(cacheKey, result, 15 * 60 * 1000);
    return result;
  }

  private async generateRecommendations(request: RecommendationRequest): Promise<Recommendation[]> {
    const contentBased = this.contentBasedFiltering(request);
    const popular = this.getPopularContent(request);
    const gap = this.knowledgeGapBased(request);

    const merged = this.mergeAndRank([contentBased, popular, gap], request.limit ?? 10);
    return merged;
  }

  private contentBasedFiltering(request: RecommendationRequest): Recommendation[] {
    const recentTopics = request.context.recentTopics ?? [];
    const currentSubject = request.context.currentSubject;

    return [
      {
        contentId: `cb-${Date.now()}-1`,
        contentType: ContentType.LESSON,
        title: `Advanced ${currentSubject ?? 'Topic'}`,
        description: `Continue learning about ${recentTopics[0] ?? currentSubject ?? 'your subject'}`,
        reason: 'Based on your recent learning history',
        score: 0.85,
        difficulty: Difficulty.INTERMEDIATE,
        estimatedDuration: 15,
      },
    ];
  }

  private getPopularContent(_request: RecommendationRequest): Recommendation[] {
    return [
      {
        contentId: `pop-${Date.now()}-1`,
        contentType: ContentType.LESSON,
        title: 'Popular Topic',
        description: 'Highly rated by other students',
        reason: 'Trending in your subject area',
        score: 0.75,
        difficulty: Difficulty.INTERMEDIATE,
        estimatedDuration: 20,
      },
    ];
  }

  private knowledgeGapBased(_request: RecommendationRequest): Recommendation[] {
    return [
      {
        contentId: `gap-${Date.now()}-1`,
        contentType: ContentType.QUIZ,
        title: 'Knowledge Check',
        description: 'Identify areas for improvement',
        reason: 'Fill gaps in your understanding',
        score: 0.90,
        difficulty: Difficulty.BEGINNER,
        estimatedDuration: 10,
      },
    ];
  }

  private mergeAndRank(sources: Recommendation[][], limit: number): Recommendation[] {
    const seen = new Set<string>();
    const merged: Recommendation[] = [];

    for (const source of sources) {
      for (const rec of source) {
        if (!seen.has(rec.contentId)) {
          seen.add(rec.contentId);
          merged.push(rec);
        }
      }
    }

    return merged.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  recordFeedback(feedback: RecommendationFeedback): void {
    const key = feedback.studentId;
    if (!this.feedbackLog.has(key)) {
      this.feedbackLog.set(key, []);
    }
    this.feedbackLog.get(key)!.push(feedback);
    this.logger.info(`Feedback recorded for ${feedback.contentId}`);
  }

  getFeedbackForContent(contentId: string): RecommendationFeedback[] {
    const allFeedback: RecommendationFeedback[] = [];
    for (const feedbacks of this.feedbackLog.values()) {
      allFeedback.push(...feedbacks.filter((f) => f.contentId === contentId));
    }
    return allFeedback;
  }

  getTrendingContent(): TrendingContent[] {
    const now = Date.now();
    const recent = 7 * 24 * 60 * 60 * 1000;
    const contentStats = new Map<string, { views: number; completions: number; ratings: number[] }>();

    for (const feedbacks of this.feedbackLog.values()) {
      for (const f of feedbacks) {
        if (now - f.timestamp.getTime() > recent) continue;
        if (!contentStats.has(f.contentId)) {
          contentStats.set(f.contentId, { views: 0, completions: 0, ratings: [] });
        }
        const stats = contentStats.get(f.contentId)!;
        stats.views++;
        stats.completions += f.completion;
        if (f.rating) stats.ratings.push(f.rating);
      }
    }

    return Array.from(contentStats.entries()).map(([contentId, stats]) => ({
      contentId,
      views: stats.views,
      completions: stats.completions,
      averageRating: stats.ratings.length > 0
        ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length
        : 0,
      trend: stats.views > 10 ? 'rising' as const : 'stable' as const,
    }));
  }
}
