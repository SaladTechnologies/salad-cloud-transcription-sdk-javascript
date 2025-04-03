import { AxiosInstance } from 'axios'
import FormData from 'form-data'
import fs from 'fs/promises'
import { createReadStream, existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { filePartSizeBytesForStorage, maxFileSizeBytesForStorage } from '../constants'
import { SignFileError, UploadError } from '../errors'
import { Semaphore } from './semaphore'

interface UploadFileResponse {
  url: string
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
export const normalizeFilePath = (filePath: string): string => {
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
export const createFormData = async (fileSource: string): Promise<FormData> => {
  console.log(!existsSync(fileSource))
  if (!existsSync(fileSource)) {
    throw new UploadError(fileSource, 'File not found')
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
    throw new UploadError(fileSource, error.message || 'Error reading file')
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
export const uploadFile = async (
  axiosInstance: AxiosInstance,
  formData: FormData,
  url: string,
  fileName: string,
): Promise<UploadFileResponse> => {
  const headers = {
    ...formData.getHeaders(),
  }

  try {
    const response = await axiosInstance.put(url, formData, { headers })
    return response.data
  } catch (error: any) {
    throw new UploadError(fileName, error.message)
  }
}

/**
 * Signs a file.
 *
 * @param axiosInstance - The axios instance configured for API requests.
 * @param url - The sign file endpoint URL.
 * @returns A promise that resolves to the signed file response.
 */
export const signFile = async (
  axiosInstance: AxiosInstance,
  url: string,
  fileName: string,
): Promise<UploadFileResponse> => {
  const requestBody = {
    method: 'GET',
    exp: '3600',
  }

  try {
    const response = await axiosInstance.post(url, requestBody)
    return response.data
  } catch (error: any) {
    throw new SignFileError(fileName, error.message)
  }
}

/**
 * Initiates a multipart upload.
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param url - The upload URL.
 * @param signal - Optional An AbortSignal to cancel the operation.
 * @returns The uploadId.
 */
export const createUpload = async (
  axiosInstance: AxiosInstance,
  url: string,
  signal?: AbortSignal,
): Promise<string> => {
  const response = await axiosInstance.put(url, null, { signal: signal })
  const { uploadId } = response.data
  return uploadId
}

/**
 * Uploads a single part (chunk) of the file.
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param url - The upload URL.
 * @param uploadId - The ID of the current multipart upload session.
 * @param partNumber - The sequential part number.
 * @param part - The chunk (Buffer) to be uploaded.
 * @param signal - Optional An AbortSignal to cancel the operation.
 * @returns The response data for this part, which should contain at least an etag and partNumber.
 */
export const uploadPart = async (
  axiosInstance: AxiosInstance,
  url: string,
  uploadId: string,
  partNumber: number,
  part: Buffer,
  signal?: AbortSignal,
): Promise<{ etag: string; partNumber: number }> => {
  const partUrl = `${url}?uploadId=${uploadId}&partNumber=${partNumber}`
  const response = await axiosInstance.put(partUrl, part, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    signal: signal,
  })
  return response.data
}

/**
 * Completes the multipart upload to combine all parts.
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param url - The upload URL.
 * @param uploadId - The ID of the current multipart upload session.
 * @param parts - Array of part information objects (each contains etag and partNumber).
 * @param signal - Optional An AbortSignal to cancel the operation.
 * @returns Response to the complete upload request.
 */
export const completeUpload = async (
  axiosInstance: AxiosInstance,
  url: string,
  uploadId: string,
  parts: { etag: string; partNumber: number }[],
  signal?: AbortSignal,
): Promise<any> => {
  const completeUrl = `${url}?action=mpu-complete&uploadId=${uploadId}`
  const response = await axiosInstance.put(completeUrl, JSON.stringify({ parts }), {
    headers: {
      'Content-Type': 'application/json',
    },
    signal: signal,
  })
  return response
}

/**
 * Reads a file in chunks and processes each chunk with a provided callback function.
 * @param filePath - The full path of the file to be read.
 * @param fileSize - The total size of the file in bytes.
 * @param maxChunkSizeBytes - The maximum size for each chunk.
 * @param eachChunk - Async callback that processes each chunk; should return an object containing etag and partNumber.
 * @param signal - Optional An AbortSignal to cancel the operation.
 * @returns A promise that resolves to an array of results from processing each chunk.
 */
export const readFileInChunks = async (
  filePath: string,
  fileSize: number,
  maxChunkSizeBytes: number,
  eachChunk: (chunkNumber: number, chunk: Buffer) => Promise<{ etag: string; partNumber: number }>,
  signal?: AbortSignal,
): Promise<{ etag: string; partNumber: number }[]> => {
  let fileHandle: fs.FileHandle
  try {
    fileHandle = await fs.open(filePath, 'r')
  } catch {
    throw new Error(`Error opening file: ${filePath}`)
  }

  const numChunks = Math.ceil(fileSize / maxChunkSizeBytes)
  const realChunkSize = Math.ceil(fileSize / numChunks)

  let bytesRead = 0
  let chunkNumber = 1
  const allChunks: { etag: string; partNumber: number }[] = []

  while (chunkNumber <= numChunks) {
    if (signal?.aborted) {
      throw new Error('Operation aborted')
    }
    const buffer = Buffer.alloc(realChunkSize)
    const { bytesRead: bytesJustRead } = await fileHandle.read(buffer, 0, realChunkSize, bytesRead)
    bytesRead += bytesJustRead
    const chunk = await eachChunk(chunkNumber, buffer)
    allChunks.push(chunk)
    chunkNumber++
  }

  await fileHandle.close()
  return allChunks
}

/**
 * Orchestrates the multipart file upload process:
 * 1. Initiates the upload session.
 * 2. Reads the file in chunks and uploads each part.
 * 3. Completes the upload once all parts are processed.
 *
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param fileName - The name of the file being uploaded.
 * @param filePath - The path of the file on the local filesystem.
 * @param fileSize - The total size of the file in bytes.
 * @param organizationName - The name of the organization (used in URL paths).
 * @param partSizeBytes - The maximum size in bytes for each file part.
 * @param signal - Optional An AbortSignal to cancel the operation.
 */
export const uploadFileInParts = async (
  axiosInstance: AxiosInstance,
  fileName: string,
  filePath: string,
  fileSize: number,
  organizationName: string,
  partSizeBytes: number,
  signal?: AbortSignal,
): Promise<void> => {
  const filesUploadUrl = `/organizations/${organizationName}/files/${fileName}`
  const filePartsUploadUrl = `/organizations/${organizationName}/file_parts/${fileName}`

  const createUploadUrl = `${filesUploadUrl}?action=mpu-create`

  const uploadId = await createUpload(axiosInstance, createUploadUrl, signal)

  const semaphore = new Semaphore(3)

  const parts = await readFileInChunks(
    filePath,
    fileSize,
    partSizeBytes,
    async (partNumber, chunk) => {
      await semaphore.acquire()
      try {
        const partResp = await uploadPart(axiosInstance, filePartsUploadUrl, uploadId, partNumber, chunk, signal)
        return partResp
      } finally {
        semaphore.release()
      }
    },
    signal,
  )

  await completeUpload(axiosInstance, filesUploadUrl, uploadId, parts, signal)
}

/**
 * Returns a remote URL for transcription.
 *
 * If the provided source is already remote, returns it.
 * Otherwise, it normalizes the file path, uploads the file, and obtains a signed URL.
 *
 * @param axiosInstance - The axios instance configured for API requests.
 * @param source - The file source, which may be a local path or remote URL.
 * @param organizationName - The organization name.
 * @param signal - Optional An AbortSignal to cancel the operation.
 * @returns A promise that resolves to a remote URL.
 */
export const getTranscriptionLocalFileSource = async (
  axiosInstance: AxiosInstance,
  source: string,
  organizationName: string,
  signal?: AbortSignal,
): Promise<string> => {
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
        signal,
      )
      const { url } = await signFile(axiosInstance, signFileRequestUrl, fileName)
      return url
    }
  } catch (error: any) {
    throw new UploadError(fileName, error.message)
  }

  const formData = await createFormData(normalizedFilePath)
  await uploadFile(axiosInstance, formData, uploadFileRequestUrl, fileName)

  const { url } = await signFile(axiosInstance, signFileRequestUrl, fileName)
  return url
}
