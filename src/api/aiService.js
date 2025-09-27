import axios from 'axios';

const OPENROUTER_KEY = import.meta.env.VITE_OPENROUTER_API_KEY;
if (!OPENROUTER_KEY) {
  console.warn('VITE_OPENROUTER_API_KEY is not set. AI calls will fail.');
}

// Axios client for OpenRouter
const client = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  headers: {
    Authorization: `Bearer ${OPENROUTER_KEY}`,
    'Content-Type': 'application/json'
  },
  timeout: 30000
});

/**
 * Call Grok Chat (OpenRouter) API
 * @param {Array<{role: string, content: string | Array}>} messages
 * @param {number} maxTokens
 * @param {number} temperature
 * @returns {Promise<string>}
 */
export async function callGrokChat(messages, maxTokens = 512, temperature = 0.2) {
  try {
    const body = {
      model: 'x-ai/grok-4-fast:free',
      messages,
      max_tokens: maxTokens,
      temperature
    };
    const resp = await client.post('/chat/completions', body);
    const choices = resp.data?.choices;
    if (choices && choices.length > 0) {
      return choices[0].message?.content || '';
    }
    return resp.data;
  } catch (err) {
    console.error('AI call error', err?.response?.data || err.message);
    throw err;
  }
}

/**
 * Generate a single interview question with hints and rubric
 * @param {string} difficulty ('easy' | 'medium' | 'hard')
 * @param {number} index
 * @returns {Promise<{question: string, hints: string[], rubric: string}>}
 */
export async function generateQuestion(difficulty, index) {
  const messages = [
    { role: 'system', content: 'You are an expert technical interviewer for Full Stack (React/Node) roles.' },
    {
      role: 'user',
      content:
        `Generate a single ${difficulty.toUpperCase()} interview question for a Full-Stack (React/Node) role. 

Requirements:
- Focus on real-world full-stack concepts, system design, React/Node architecture, API integration, performance, or debugging scenarios.
- Do NOT ask the candidate to write isolated small functions (like filtering arrays or string manipulation), or build full websites.
- The question should test understanding, reasoning, or problem-solving in a real interview context.

Return a minimal JSON object with the following keys:
- "question" (string)
- "hints" (array of up to 2 strings)
- "rubric" (string, max one sentence)

Provide only JSON output. This is question number ${index}.
`
    }
  ];

  const raw = await callGrokChat(messages, 350, 0.2);

  // Extract JSON safely
  try {
    const match = raw.match(/\{[\s\S]*\}$/);
    return match ? JSON.parse(match[0]) : JSON.parse(raw);
  } catch {
    return { question: raw, hints: [], rubric: '' };
  }
}

/**
 * Grade all candidate answers and return scores summary
 * @param {Object} candidate {name, email, phone}
 * @param {Array<{question: string, answer: string, difficulty: string}>} qas
 * @returns {Promise<Object>} { results, TOTAL_SCORE, SUMMARY }
 */
export async function gradeAnswers(candidate, qas) {
  const system = {
    role: 'system',
    content:
      'You are an objective grader. For each question-answer pair provide score 0-5 and short feedback. Then compute TOTAL_SCORE (out of 30) and a two-sentence SUMMARY.'
  };

  let userContent = `Candidate: ${candidate.name || 'Unknown'}\nEmail: ${candidate.email || 'NA'}\nPhone: ${candidate.phone || 'NA'}\n\n`;
  qas.forEach((q, i) => {
    userContent += `Q${i + 1} (${q.difficulty}): ${q.question}\nAnswer: ${q.answer || '<no answer>'}\n\n`;
  });
  userContent += '\nReturn a JSON object: { results: [{index, score, feedback}], TOTAL_SCORE: number, SUMMARY: string }';

  const messages = [system, { role: 'user', content: userContent }];
  const raw = await callGrokChat(messages, 900, 0.1);

  try {
    const match = raw.match(/\{[\s\S]*\}$/);
    return match ? JSON.parse(match[0]) : JSON.parse(raw);
  } catch {
    return { raw };
  }
}

/**
 * Generic assistant prompt
 * @param {string} text
 * @returns {Promise<string>}
 */
export async function assistantPrompt(text) {
  const messages = [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: text }
  ];
  return await callGrokChat(messages, 300, 0.3);
}
