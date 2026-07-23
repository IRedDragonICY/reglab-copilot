const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

const newTest = `
describe('runAgentLoop — early termination prevention', () => {
  beforeEach(() => {
    mockGenerateContentStream.mockReset();
    mockGoogleGenAI.mockReset();
    mockGoogleGenAI.mockImplementation(() => ({
      models: { generateContentStream: mockGenerateContentStream },
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prevents termination if not all code cells are analyzed', async () => {
    vi.useFakeTimers();

    // Iteration 1: calls mark_task_complete
    mockGenerateContentStream.mockResolvedValueOnce(
      asyncIterable([
        toolCallChunk('mark_task_complete', { summary: 'Done' })
      ])
    );
    // Iteration 2: returns text
    mockGenerateContentStream.mockResolvedValueOnce(
      asyncIterable([
        textChunk('Okay, continuing')
      ])
    );

    const ctx = {
      images: { pre_test: [], implementasi: [], post_test: [], notebook: [] },
      notebooks: [
        {
          cells: [
            { type: 'code', source: 'print(1)', outputs: [] },
            { type: 'code', source: 'print(2)', outputs: [] },
          ]
        }
      ],
      aiData: { cellAnalyses: [] },
    };

    const result = await runAgentLoop({
      apiKey: 'test-key',
      modelId: 'test-model',
      contents: [{ role: 'user', parts: [{ text: 'Start' }] }],
      systemInstruction: 'Test',
      declarationKey: 'praktikum',
      initialAiData: { cellAnalyses: [{ cellIndex: 0, notebookIndex: 0, section: 'implementasi', caption: '1', explanation: '1' }] },
      maxLoops: 5,
      ctx: ctx as any,
      callbacks: {},
    });

    // The SDK should have been called twice because it intercepted the completion
    expect(mockGenerateContentStream).toHaveBeenCalledTimes(2);
  });
});
`;

code = code.replace(/describe\('runAgentLoop — early termination prevention'[\s\S]*?\}\);\n\}\);/g, "");
code = code + newTest;
fs.writeFileSync('src/lib/ai/agent-loop.test.ts', code);
