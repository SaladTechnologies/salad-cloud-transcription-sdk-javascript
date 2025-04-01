import FormData from 'form-data'
import fsPromises from 'fs/promises'
import { FileHandle } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  completeUpload,
  createFormData,
  createUpload,
  normalizeFilePath,
  readFileInChunks,
  signFile,
  uploadFile,
  uploadPart,
} from '../src/transcription/node'

const testUrl = 'http://test-url.com'
const testUploadId = '12345'
const testFilePath = '/fake/path/file.txt'

/**
 * Helper to create an axios mock instance.
 *
 * @param method - HTTP method to mock ('put' or 'post')
 * @param response - The response to resolve with (or error message if shouldError is true)
 * @param shouldError - Whether the axios method should throw an error
 */
const createAxiosInstance = <T extends 'put' | 'post'>(method: T, response: any, shouldError = false) => {
  const instance = {} as Record<T, any>
  instance[method] = shouldError
    ? vi.fn().mockRejectedValue(new Error(typeof response === 'string' ? response : 'Error'))
    : vi.fn().mockResolvedValue({ data: response })
  return instance
}

describe('normalizeFilePath', () => {
  it('should resolve relative paths to absolute paths', () => {
    const relativePath = './test.txt'
    const normalized = normalizeFilePath(relativePath)
    expect(path.isAbsolute(normalized)).toBe(true)
  })

  it('should expand tilde', () => {
    const originalHome = process.env.HOME
    process.env.HOME = '/home/testuser'
    const input = '~/documents/file.txt'
    const result = normalizeFilePath(input)
    const expected = path.resolve('/home/testuser/documents/file.txt')
    expect(result).toBe(expected)
    process.env.HOME = originalHome
  })

  it('should handle file URLs', () => {
    const fileUrl = 'file:///tmp/test.txt'
    const normalized = normalizeFilePath(fileUrl)
    expect(path.isAbsolute(normalized)).toBe(true)
  })

  it('should expand environment variables in Unix style', () => {
    process.env.TEST_VAR = 'myvalue'
    const varPath = '$TEST_VAR/file.txt'
    const normalized = normalizeFilePath(varPath)
    expect(normalized).toContain('myvalue')
  })
})

describe('createFormData', () => {
  it('should return a FormData instance when file exists and the stream opens successfully', async () => {
    vi.mock('fs', () => ({
      existsSync: vi.fn(() => true),
      createReadStream: vi.fn(() => {
        const stream = new Readable({
          read() {},
        })
        setImmediate(() => stream.emit('open'))
        return stream
      }),
    }))

    const formData = await createFormData('/fake/file.txt')
    expect(formData).toBeInstanceOf(FormData)
    expect(formData.getBoundary()).toBeDefined()
  })
})

describe('uploadFile', () => {
  const uploadResponse = { url: 'http://uploaded-file.com' }

  it('should return response data on success', async () => {
    const axiosInstance: any = createAxiosInstance('put', uploadResponse)
    const formData = new FormData()
    formData.append('test', 'data')

    const result = await uploadFile(axiosInstance, formData, testUrl)
    expect(result).toEqual(uploadResponse)
    expect(axiosInstance.put).toHaveBeenCalledWith(testUrl, formData, {
      headers: formData.getHeaders(),
    })
  })

  it('should throw an error on failure', async () => {
    const axiosInstance: any = createAxiosInstance('put', 'Upload failed', true)
    const formData = new FormData()
    await expect(uploadFile(axiosInstance, formData, testUrl)).rejects.toThrow(/Error uploading file/)
  })
})

describe('signFile', () => {
  const signResponse = { url: 'http://signed-file.com' }

  it('should return signed file data on success', async () => {
    const axiosInstance: any = createAxiosInstance('post', signResponse)
    const result = await signFile(axiosInstance as any, testUrl)
    expect(result).toEqual(signResponse)
    expect(axiosInstance.post).toHaveBeenCalledWith(testUrl, { method: 'GET', exp: '3600' })
  })

  it('should throw an error on failure', async () => {
    const axiosInstance: any = createAxiosInstance('post', 'Sign failed', true)
    await expect(signFile(axiosInstance as any, testUrl)).rejects.toThrow(/Error signing file/)
  })
})

describe('createUpload', () => {
  it('should return uploadId on success', async () => {
    const axiosInstance: any = createAxiosInstance('put', { uploadId: testUploadId })
    const uploadId = await createUpload(axiosInstance as any, testUrl)
    expect(uploadId).toBe(testUploadId)
    expect(axiosInstance.put).toHaveBeenCalledWith(testUrl)
  })
})

describe('uploadPart', () => {
  const partNumber = 1
  const testBuffer = Buffer.from('test data')
  const testPartResponse = { etag: 'etag123', partNumber }

  it('should return part response on success', async () => {
    const axiosInstance: any = createAxiosInstance('put', testPartResponse)
    const result = await uploadPart(axiosInstance as any, testUrl, testUploadId, partNumber, testBuffer)
    expect(result).toEqual(testPartResponse)
    expect(axiosInstance.put).toHaveBeenCalledWith(
      `${testUrl}?uploadId=${testUploadId}&partNumber=${partNumber}`,
      testBuffer,
      { headers: { 'Content-Type': 'application/octet-stream' } },
    )
  })
})

describe('completeUpload', () => {
  const parts = [
    { etag: 'etag1', partNumber: 1 },
    { etag: 'etag2', partNumber: 2 },
  ]
  const completeResponse = { status: 'completed' }

  it('should return response on success', async () => {
    const axiosInstance: any = createAxiosInstance('put', completeResponse)
    const result = await completeUpload(axiosInstance as any, testUrl, testUploadId, parts)
    expect(result).toEqual({ data: completeResponse })
    expect(axiosInstance.put).toHaveBeenCalledWith(
      `${testUrl}?action=mpu-complete&uploadId=${testUploadId}`,
      JSON.stringify({ parts }),
      { headers: { 'Content-Type': 'application/json' } },
    )
  })
})

describe('readFileInChunks', () => {
  const fileSize = 1000
  const maxChunkSizeForTest = 400
  const numChunks = Math.ceil(fileSize / maxChunkSizeForTest)
  const realChunkSize = Math.ceil(fileSize / numChunks)

  let fakeFileHandle: {
    read: (...args: any[]) => Promise<{ bytesRead: number }>
    close: () => Promise<void>
  }
  let readCalls = 0

  beforeEach(() => {
    readCalls = 0
    fakeFileHandle = {
      read: vi.fn().mockImplementation(async (_buffer: Buffer, _offset: number, length: number, _position: number) => {
        readCalls++
        if (readCalls < numChunks) {
          return { bytesRead: length }
        } else {
          return { bytesRead: fileSize - (numChunks - 1) * realChunkSize }
        }
      }),
      close: vi.fn().mockResolvedValue(undefined),
    }
    vi.spyOn(fsPromises, 'open').mockResolvedValue(fakeFileHandle as unknown as FileHandle)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process file chunks correctly', async () => {
    const eachChunk = vi.fn().mockImplementation(async (chunkNumber: number, chunk: Buffer) => {
      return { etag: `etag-${chunkNumber}`, partNumber: chunkNumber }
    })
    const results = await readFileInChunks(testFilePath, fileSize, maxChunkSizeForTest, eachChunk)
    expect(fsPromises.open).toHaveBeenCalledWith(testFilePath, 'r')
    expect(fakeFileHandle.read).toHaveBeenCalledTimes(numChunks)
    expect(eachChunk).toHaveBeenCalledTimes(numChunks)
    expect(fakeFileHandle.close).toHaveBeenCalled()
    expect(results).toEqual(
      Array.from({ length: numChunks }, (_, i) => ({
        etag: `etag-${i + 1}`,
        partNumber: i + 1,
      })),
    )
  })

  it('should throw an error when file open fails', async () => {
    const openSpy = vi.spyOn(fsPromises, 'open').mockRejectedValue(new Error('open error'))
    const eachChunk = vi.fn()
    await expect(readFileInChunks(testFilePath, fileSize, maxChunkSizeForTest, eachChunk)).rejects.toThrow(
      `Error opening file: ${testFilePath}`,
    )
    openSpy.mockRestore()
  })
})
