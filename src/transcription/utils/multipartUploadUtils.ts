import { AxiosInstance } from 'axios'
import fs from 'fs/promises'
import { Semaphore } from './semaphore'

/**
 * Initiates a multipart upload.
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param url - The upload URL.
 * @returns The uploadId.
 */
export const createUpload = async (axiosInstance: AxiosInstance, url: string): Promise<string> => {
  const response = await axiosInstance.put(url)
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
 * @returns The response data for this part, which should contain at least an etag and partNumber.
 */
export const uploadPart = async (
  axiosInstance: AxiosInstance,
  url: string,
  uploadId: string,
  partNumber: number,
  part: Buffer,
): Promise<{ etag: string; partNumber: number }> => {
  const partUrl = `${url}?uploadId=${uploadId}&partNumber=${partNumber}`
  const response = await axiosInstance.put(partUrl, part, {
    headers: {
      'Content-Type': 'application/octet-stream',
    },
  })
  return response.data
}

/**
 * Completes the multipart upload to combine all parts.
 * @param axiosInstance - The Axios instance for making HTTP requests.
 * @param url - The upload URL.
 * @param uploadId - The ID of the current multipart upload session.
 * @param parts - Array of part information objects (each contains etag and partNumber).
 * @returns Response to the complete upload request.
 */
export const completeUpload = async (
  axiosInstance: AxiosInstance,
  url: string,
  uploadId: string,
  parts: { etag: string; partNumber: number }[],
): Promise<any> => {
  const completeUrl = `${url}?action=mpu-complete&uploadId=${uploadId}`
  const response = await axiosInstance.put(completeUrl, JSON.stringify({ parts }), {
    headers: {
      'Content-Type': 'application/json',
    },
  })
  return response
}

/**
 * Reads a file in chunks and processes each chunk with a provided callback function.
 * @param filePath - The full path of the file to be read.
 * @param fileSize - The total size of the file in bytes.
 * @param maxChunkSizeBytes - The maximum size for each chunk.
 * @param eachChunk - Async callback that processes each chunk; should return an object containing etag and partNumber.
 * @returns A promise that resolves to an array of results from processing each chunk.
 */
const readFileInChunks = async (
  filePath: string,
  fileSize: number,
  maxChunkSizeBytes: number,
  eachChunk: (chunkNumber: number, chunk: Buffer) => Promise<{ etag: string; partNumber: number }>,
): Promise<{ etag: string; partNumber: number }[]> => {
  let fileHandle: fs.FileHandle
  try {
    fileHandle = await fs.open(filePath, 'r')
  } catch (e: any) {
    throw new Error(`Error opening file: ${filePath}`)
  }

  // Calculate the number of chunks and the balanced chunk size
  const numChunks = Math.ceil(fileSize / maxChunkSizeBytes)
  const realChunkSize = Math.ceil(fileSize / numChunks)

  let bytesRead = 0
  let chunkNumber = 1
  const allChunks: Promise<{ etag: string; partNumber: number }>[] = []

  // Read the file in chunks sequentially
  while (chunkNumber <= numChunks) {
    const buffer = Buffer.alloc(realChunkSize)
    const { bytesRead: bytesJustRead } = await fileHandle.read(buffer, 0, realChunkSize, bytesRead)
    bytesRead += bytesJustRead
    // Process each chunk using the provided callback function
    allChunks.push(eachChunk(chunkNumber, buffer))
    chunkNumber++
  }

  await fileHandle.close()
  return Promise.all(allChunks)
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
 */
export const uploadFileInParts = async (
  axiosInstance: AxiosInstance,
  fileName: string,
  filePath: string,
  fileSize: number,
  organizationName: string,
  partSizeBytes: number,
): Promise<void> => {
  // Construct URLs for the upload process
  const filesUploadUrl = `/organizations/${organizationName}/files/${fileName}`
  const filePartsUploadUrl = `/organizations/${organizationName}/file_parts/${fileName}`

  const createUploadUrl = `${filesUploadUrl}?action=mpu-create`

  // Start the upload process by creating an upload session and getting an uploadId
  const uploadId = await createUpload(axiosInstance, createUploadUrl)

  const semaphore = new Semaphore(3)

  // Read file in chunks and upload each part sequentially.
  // Note: You could introduce a semaphore here to limit concurrent uploads if desired.
  const parts = await readFileInChunks(filePath, fileSize, partSizeBytes, async (partNumber, chunk) => {
    await semaphore.acquire()
    try {
      const partResp = await uploadPart(axiosInstance, filePartsUploadUrl, uploadId, partNumber, chunk)
      return partResp
    } finally {
      semaphore.release()
    }
  })

  // Finalize the upload by sending the parts info.
  await completeUpload(axiosInstance, filesUploadUrl, uploadId, parts)
}
