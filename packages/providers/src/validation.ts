import Ajv from 'ajv';

export function validateProviderOutput(schema: Record<string, unknown>, output: unknown): unknown {
  const ajv = new Ajv({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(output)) {
    const details = (validate.errors ?? []).map((error) => `${error.instancePath || '$'} ${error.message}`).join('; ');
    throw new Error(`Provider output failed JSON Schema validation: ${details}`);
  }
  return output;
}
