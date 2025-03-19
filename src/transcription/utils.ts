import { TranscribeRequest } from './types'
import { createReadStream, existsSync } from 'node:fs'
import FormData from 'form-data'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { AxiosInstance } from 'axios'

interface UploadFileResponse {
  url: string
}

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
 * Normalizes a file path string to an absolute path.
 *
 * Handles:
 * - File URLs (e.g. "file:///C:/path/to/file.txt")
 * - Tilde expansion for home directories (e.g. "~/file.txt")
 * - Environment variables (e.g. "$HOME/file.txt" or "%APPDATA%\\file.txt")
 * - Relative paths (resolved against process.cwd())
 *
 * @param filePath - The file path string.
 * @returns A normalized absolute file path.
 */
const normalizeFilePath = (filePath: string): string => {
  // Handle file URLs (e.g. "file:///C:/path/to/file.txt")
  if (filePath.startsWith('file://')) {
    try {
      filePath = fileURLToPath(filePath)
    } catch (error) {
      console.error('Error converting file URL to path:', error)
    }
  }

  // Expand tilde to home directory (only if filePath starts with "~")
  if (filePath.startsWith('~')) {
    const home = process.env.HOME || process.env.USERPROFILE
    if (home) {
      filePath = filePath.replace(/^~(?=$|\/|\\)/, home)
    }
  }

  // Expand environment variables for Unix-style ($VAR)
  filePath = filePath.replace(/\$(\w+)/g, (_, name) => process.env[name] || `$${name}`)

  // Expand environment variables for Windows-style (%VAR%)
  filePath = filePath.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`)

  // Resolve relative paths to absolute paths (using process.cwd() as the base)
  return path.resolve(filePath)
}

/**
 * Creates a FormData instance with a file stream from the provided file source.
 *
 * @param fileSource - The path to the file.
 * @returns A FormData instance containing the file.
 */
const createFormData = async (fileSource: string): Promise<FormData> => {
  if (!existsSync(fileSource)) {
    throw new Error(`File not found: ${fileSource}`)
  }

  const stream = createReadStream(fileSource)

  try {
    await new Promise<void>((resolve, reject) => {
      stream.once('open', () => resolve())
      stream.once('error', (err) => reject(err))
    })

    const formData = new FormData()
    formData.append('file', stream)
    return formData
  } catch (error: any) {
    throw new Error(`Error reading file: ${error.message || 'Unknown error'}`)
  }
}

/**
 * Checks if the provided source string is a remote URL.
 *
 * @param source - The source string.
 * @returns True if the source is a remote URL, false otherwise.
 */
const isRemoteFile = (source: string): boolean => {
  try {
    const url = new URL(source)
    return ['http:', 'https:', 'ftp:'].includes(url.protocol)
  } catch {
    return false
  }
}

/**
 * Uploads a file.
 *
 * @param axiosInstance - The axios instance configured for API requests.
 * @param formData - The FormData instance containing the file.
 * @param url - The upload URL.
 * @returns A promise that resolves to the upload file response.
 */
const uploadFile = async (
  axiosInstance: AxiosInstance,
  formData: FormData,
  url: string,
): Promise<UploadFileResponse> => {
  const headers = {
    ...formData.getHeaders(),
  }

  try {
    const response = await axiosInstance.put(url, formData, { headers })
    return response.data
  } catch (error: any) {
    throw new Error(`Error uploading file: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Signs a file.
 *
 * @param axiosInstance - The axios instance configured for API requests.
 * @param url - The sign file endpoint URL.
 * @returns A promise that resolves to the signed file response.
 */
const signFile = async (axiosInstance: AxiosInstance, url: string): Promise<UploadFileResponse> => {
  const requestBody = {
    method: 'GET',
    exp: '3600',
  }

  try {
    const response = await axiosInstance.post(url, requestBody)
    return response.data
  } catch (error: any) {
    throw new Error(`Error signing file: ${error?.message || 'Unknown error'}`)
  }
}

/**
 * Returns a remote URL for transcription.
 *
 * If the provided source is already remote, returns it.
 * Otherwise, it normalizes the file path, uploads the file, and obtains a signed URL.
 *
 * @param source - The file source, which may be a local path or remote URL.
 * @param organizationName - The organization name.
 * @returns A promise that resolves to a remote URL.
 */
export const getTranscriptionSource = async (
  axiosInstance: AxiosInstance,
  source: string,
  organizationName: string,
): Promise<string> => {
  if (isRemoteFile(source)) {
    return source
  }

  // Normalize the local file path and extract the file name.
  const normalizedFilePath = normalizeFilePath(source)
  const fileName = path.basename(normalizedFilePath)

  // Create FormData for the file and upload it.
  const formData = await createFormData(normalizedFilePath)
  const uploadFileRequestUrl = `/organizations/${organizationName}/files/${fileName}`
  await uploadFile(axiosInstance, formData, uploadFileRequestUrl)

  // Sign the file to obtain a remote URL.
  const signFileRequestUrl = `/organizations/${organizationName}/file_tokens/${fileName}`
  const { url } = await signFile(axiosInstance, signFileRequestUrl)
  return url
}
