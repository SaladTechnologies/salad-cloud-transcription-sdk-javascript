import axios, { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { filePartSizeBytesForStorage, maxFileSizeBytesForStorage } from '../constants'
import { uploadFileInParts } from './multipartUploadUtils'

interface UploadFileResponse {
  url: string
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
      const url = new URL(filePath)
      if (process.platform === 'win32' && !/^\/[A-Za-z]:/.test(url.pathname)) {
        filePath = filePath.replace(/^file:\/\//, '')
        filePath = filePath.replace(/^\/+/, '')
      } else {
        filePath = fileURLToPath(filePath)
      }
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

  const uploadFileRequestUrl = `/organizations/${organizationName}/files/${fileName}`
  const signFileRequestUrl = `/organizations/${organizationName}/file_tokens/${fileName}`

  try {
    const stats = await fs.stat(normalizedFilePath)
    const fileSize = stats.size

    if (fileSize > maxFileSizeBytesForStorage) {
      await uploadFileInParts(
        axiosInstance,
        fileName,
        normalizedFilePath,
        fileSize,
        organizationName,
        filePartSizeBytesForStorage,
      )
      const { url } = await signFile(axiosInstance, signFileRequestUrl)
      return url
    }
  } catch (err) {
    throw new Error(`Error uploading file: ${source} with error: ${err}`)
  }

  // Create FormData for the file and upload it.
  const formData = await createFormData(normalizedFilePath)
  await uploadFile(axiosInstance, formData, uploadFileRequestUrl)

  // Sign the file to obtain a remote URL.
  const { url } = await signFile(axiosInstance, signFileRequestUrl)
  return url
}

/**
 * Checks if a URL is likely to be downloadable.
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
