const source = {
  type: 'object', additionalProperties: false,
  required: ['id', 'url', 'title', 'publisher', 'publishedAt', 'retrievedAt', 'contentDigest', 'excerpt'],
  properties: {
    id: { type: 'string' }, url: { type: 'string', pattern: '^https?://' }, title: { type: 'string' }, publisher: { type: 'string' },
    publishedAt: { type: ['string', 'null'] },
    retrievedAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?Z$' },
    contentDigest: { type: 'string', pattern: '^[a-f0-9]{64}$' }, excerpt: { type: 'string', maxLength: 1200 },
  },
};
const claim = {
  type: 'object', additionalProperties: false, required: ['id', 'text', 'sourceIds'],
  properties: { id: { type: 'string' }, text: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } } },
};
const verdict = {
  type: 'object', additionalProperties: false, required: ['claimId', 'status', 'rationale', 'sourceIds'],
  properties: {
    claimId: { type: 'string' }, status: { type: 'string', enum: ['supported', 'disputed', 'unresolved'] },
    rationale: { type: 'string' }, sourceIds: { type: 'array', items: { type: 'string' } },
  },
};

export const researcherSchema = {
  type: 'object', additionalProperties: false, required: ['sources', 'claims'],
  properties: { sources: { type: 'array', items: source }, claims: { type: 'array', items: claim } },
};
export const challengerSchema = {
  type: 'object', additionalProperties: false, required: ['sources', 'counterevidence', 'staleClaims', 'missingEvidence'],
  properties: {
    sources: { type: 'array', items: source }, counterevidence: { type: 'array', items: claim },
    staleClaims: { type: 'array', items: { type: 'string' } }, missingEvidence: { type: 'array', items: { type: 'string' } },
  },
};
export const adjudicatorSchema = {
  type: 'object', additionalProperties: false,
  required: ['question', 'briefEn', 'sources', 'claims', 'counterevidence', 'verdicts', 'unresolvedQuestions'],
  properties: {
    question: { type: 'string' }, briefEn: { type: 'string' },
    sources: { type: 'array', items: source }, claims: { type: 'array', items: claim }, counterevidence: { type: 'array', items: claim },
    verdicts: { type: 'array', items: verdict }, unresolvedQuestions: { type: 'array', items: { type: 'string' } },
  },
};
