import { TranscribeRequest } from '../types'

/**
 * Transforms a transcribe request to the API-expected format.
 *
 * Maps `source` to `input.url` and converts translation arrays (if present)
 * into comma-separated strings.
 *
 * @param transcribeRequest - The original transcribe request.
 * @returns The transformed request object.
 */
export const transformTranscribeRequest = (transcribeRequest: TranscribeRequest): Record<string, any> => {
  const { source, organizationName, options, ...rest } = transcribeRequest

  const transformedOptions = options
    ? {
        ...options,
        llm_translation: options.llmTranslation?.join(', '),
        srt_translation: options.srtTranslation?.join(', '),
      }
    : {}

  return {
    ...rest,
    input: {
      url: source,
      ...transformedOptions,
    },
  }
}
