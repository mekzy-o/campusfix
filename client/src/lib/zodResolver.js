/**
 * Minimal adapter so react-hook-form can validate with a Zod schema.
 * The same rules as the API are applied in the browser for instant feedback.
 */
export function zodResolver(schema) {
  return async (values) => {
    const result = schema.safeParse(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.');
      if (!errors[key]) errors[key] = { type: issue.code, message: issue.message };
    }
    return { values: {}, errors };
  };
}
