import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import MockAdapter from "axios-mock-adapter";

// Mock env var
vi.stubGlobal("import", {
  meta: {
    env: {
      VITE_OPENROUTER_API_KEY: "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"
    }
  }
});

// Import service AFTER mocks
import {
  callGrokChat,
  generateQuestion,
  gradeAnswers,
  assistantPrompt
} from '../../src/api/aiService.js'; // adjust path if needed

let mock;

beforeEach(() => {
  mock = new MockAdapter(axios);
  mock.reset();
});

describe("AI Service API Tests (mocked LLM)", () => {
  it("callGrokChat returns LLM content", async () => {
    mock.onPost("https://openrouter.ai/api/v1/chat/completions")
        .reply(200, {
          choices: [{ message: { content: "Hello from AI" } }]
        });

    const result = await callGrokChat([{ role: "user", content: "hi" }]);
    expect(result).toBe("Hello from AI");
  });

  it("generateQuestion returns parsed JSON", async () => {
    const mockJSON = JSON.stringify({
      question: "Explain React hooks?",
      hints: ["Think useState", "Think useEffect"],
      rubric: "Tests React understanding"
    });

    mock.onPost("https://openrouter.ai/api/v1/chat/completions")
        .reply(200, { choices: [{ message: { content: mockJSON } }] });

    const result = await generateQuestion("easy", 1);
    expect(result.question).toBeDefined();
    expect(result.hints).toBeInstanceOf(Array);
    expect(result.rubric).toBeDefined();
  });

  it("gradeAnswers returns parsed grading result", async () => {
    const mockJSON = JSON.stringify({
      results: [{ index: 1, score: 5, feedback: "Good answer" }],
      TOTAL_SCORE: 5,
      SUMMARY: "Strong performance"
    });

    mock.onPost("https://openrouter.ai/api/v1/chat/completions")
        .reply(200, { choices: [{ message: { content: mockJSON } }] });

    const candidate = { name: "A", email: "a@a.com", phone: "000" };
    const qas = [{ question: "What is Node?", answer: "Runtime", difficulty: "easy" }];

    const result = await gradeAnswers(candidate, qas);
    expect(result.TOTAL_SCORE).toBe(5);
  });

  it("assistantPrompt returns LLM reply", async () => {
    mock.onPost("https://openrouter.ai/api/v1/chat/completions")
        .reply(200, {
          choices: [{ message: { content: "I am your assistant." } }]
        });

    const res = await assistantPrompt("hello");
    expect(res).toBe("I am your assistant.");
  });
});
