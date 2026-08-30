let input = '';
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input.trim());
if (request.model === 'timeout') await new Promise((resolve) => setTimeout(resolve, 5_000));
if (request.model === 'oversize') process.stdout.write('x'.repeat(50_000));
else if (request.model === 'invalid') process.stdout.write(`${JSON.stringify({ type: 'result', output: { wrong: true } })}\n`);
else process.stdout.write(`${JSON.stringify({ type: 'result', output: { answer: 'bounded' }, usage: { inputTokens: 4, outputTokens: 2 } })}\n`);
