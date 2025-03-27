import axios from 'axios'
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

/**
 * Checks if the provided source string is a remote URL.
 *
 * @param source - The source string.
 * @returns True if the source is a remote URL, false otherwise.
 */
export const isRemoteFile = (source: string): boolean => {
  try {
    const url = new URL(source)
    return ['http:', 'https:', 'ftp:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Checks if a URL is downloadable.
 *
 * @param url - The URL to check.
 * @returns A Promise that resolves to true if the URL appears to be downloadable; otherwise, false.
 */
export const checkIfUrlDownloadable = async (url: string): Promise<boolean> => {
  try {
    const response = await axios.get(url, {
      headers: {
        Range: 'bytes=0-0',
      },
      responseType: 'stream',
      maxRedirects: 5,
    })

    if (response.status === 206 || response.status === 200) {
      const contentDisposition = response.headers['content-disposition'] || ''
      if (contentDisposition.toLowerCase().includes('attachment')) {
        return true
      }

      const contentType = response.headers['content-type'] || ''
      if (!contentType.toLowerCase().startsWith('text/html')) {
        return true
      }
    }
  } catch (error) {
    return false
  }
  return false
}

/**
 * This function is intended for retrieving the transcription source from a local file.
 * However, in browser environments, local file system access is not supported.
 *
 * For browsers, this function will always reject with an error.
 *
 * @param axiosInstance - The axios instance configured for API requests.
 * @param source - The file source, which may be a local path or remote URL.
 * @param organizationName - The organization name.
 * @returns A Promise that rejects with an error stating local files are not supported.
 */
export const getTranscriptionLocalFileSource = async (
  axiosInstance: any,
  source: string,
  organizationName: string,
): Promise<string> => {
  // Immediately reject since browsers do not support accessing local files.
  return Promise.reject(new Error('Local files are not supported in browser environments'))
}
