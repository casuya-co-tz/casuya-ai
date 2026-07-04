import { CasuyaAI } from '../../src/casuya-ai';
import { TutoringMode, TutoringSubject, Language, Difficulty, QuestionType, QuestionCategory } from '../../src/types';

describe('Tutoring Flow Integration', () => {
  let casuya: CasuyaAI;

  beforeAll(() => {
    casuya = new CasuyaAI();
  });

  afterAll(async () => {
    await casuya.shutdown();
  });

  it('should create tutoring session', async () => {
    const response = await casuya.tutor({
      studentId: 'student-1',
      subject: TutoringSubject.MATHEMATICS,
      topic: 'Algebra Basics',
      mode: TutoringMode.EXPLAIN,
      message: 'What is a variable?',
      preferences: {
        language: Language.ENGLISH,
        difficulty: Difficulty.BEGINNER,
        explanationDepth: 'moderate',
        pace: 'normal',
        includeExamples: true,
        includeVisualizations: false,
        socraticMethod: false,
      },
    });

    expect(response).toBeDefined();
    expect(response.message).toBeTruthy();
    expect(response.mode).toBe(TutoringMode.EXPLAIN);
    expect(response.usage.totalCost).toBeGreaterThanOrEqual(0);
  });

  it('should generate questions', async () => {
    const questions = await casuya.generateQuestions({
      subject: 'science',
      topic: 'Photosynthesis',
      questionType: QuestionType.MULTIPLE_CHOICE,
      difficulty: Difficulty.INTERMEDIATE,
      category: QuestionCategory.COMPREHENSION,
      count: 3,
      language: Language.ENGLISH,
    });

    expect(questions).toBeDefined();
    expect(Array.isArray(questions)).toBe(true);
  });

  it('should provide health check', async () => {
    const health = await casuya.healthCheck();
    expect(health).toBeDefined();
    expect(typeof health.healthy).toBe('boolean');
    expect(Array.isArray(health.providers)).toBe(true);
  });
});
