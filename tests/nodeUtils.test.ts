import FormData from 'form-data'
import fsPromises from 'fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as utils from '../src/transcription/node'
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
import {
  createAxiosInstance,
  setupFakeFileHandle,
  testFileName,
  testFilePath,
  testFileSize,
  testMaxChunkSize,
  testNumChunks,
  testOrganizationName,
  testRealChunkSize,
  testUploadId,
  testUrl,
} from './shared'

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

    const result = await uploadFile(axiosInstance, formData, testUrl, testFileName)
    expect(result).toEqual(uploadResponse)
    expect(axiosInstance.put).toHaveBeenCalledWith(testUrl, formData, {
      headers: formData.getHeaders(),
    })
  })

  it('should throw an error on failure', async () => {
    const putResponse = 'Upload failed'
    const axiosInstance: any = createAxiosInstance('put', putResponse, true)
    const formData = new FormData()
    await expect(uploadFile(axiosInstance, formData, testUrl, testFileName)).rejects.toThrow(
      `Upload of file "${testFileName}" failed: ${putResponse}`,
    )
  })
})

describe('signFile', () => {
  const signResponse = { url: 'http://signed-file.com' }

  it('should return signed file data on success', async () => {
    const axiosInstance: any = createAxiosInstance('post', signResponse)
    const result = await signFile(axiosInstance as any, testUrl, testFileName)
    expect(result).toEqual(signResponse)
    expect(axiosInstance.post).toHaveBeenCalledWith(testUrl, { method: 'GET', exp: '3600' })
  })

  it('should throw an error on failure', async () => {
    const postResponse = 'Sign failed'
    const axiosInstance: any = createAxiosInstance('post', postResponse, true)
    await expect(signFile(axiosInstance as any, testUrl, testFileName)).rejects.toThrow(
      `Signing file "${testFileName}" failed: ${postResponse}`,
    )
  })
})

describe('createUpload', () => {
  it('should return uploadId on success', async () => {
    const axiosInstance: any = createAxiosInstance('put', { uploadId: testUploadId })
    const controller = new AbortController()
    const uploadId = await createUpload(axiosInstance as any, testUrl, controller.signal)
    expect(uploadId).toBe(testUploadId)
    expect(axiosInstance.put).toHaveBeenCalledWith(testUrl, null, { signal: controller.signal })
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
    { partNumber: 1, etag: 'etag123' },
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
  let fakeFileHandle: ReturnType<typeof setupFakeFileHandle>

  beforeEach(() => {
    fakeFileHandle = setupFakeFileHandle(testFileSize, testNumChunks, testRealChunkSize)
    vi.spyOn(fsPromises, 'open').mockResolvedValue(fakeFileHandle as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should process file chunks correctly', async () => {
    const eachChunk = vi.fn().mockImplementation(async (chunkNumber: number) => {
      return { etag: `etag-${chunkNumber}`, partNumber: chunkNumber }
    })
    const results = await readFileInChunks(testFilePath, testFileSize, testMaxChunkSize, eachChunk)
    expect(fsPromises.open).toHaveBeenCalledWith(testFilePath, 'r')
    expect(fakeFileHandle.read).toHaveBeenCalledTimes(testNumChunks)
    expect(eachChunk).toHaveBeenCalledTimes(testNumChunks)
    expect(fakeFileHandle.close).toHaveBeenCalled()
    expect(results).toEqual(
      Array.from({ length: testNumChunks }, (_, i) => ({
        etag: `etag-${i + 1}`,
        partNumber: i + 1,
      })),
    )
  })

  it('should throw an error when file open fails', async () => {
    const openSpy = vi.spyOn(fsPromises, 'open').mockRejectedValue(new Error('open error'))
    const eachChunk = vi.fn()
    await expect(readFileInChunks(testFilePath, testFileSize, testMaxChunkSize, eachChunk)).rejects.toThrow(
      `Error opening file: ${testFilePath}`,
    )
    openSpy.mockRestore()
  })
})

describe('uploadFileInParts', () => {
  let fakeFileHandle: ReturnType<typeof setupFakeFileHandle>

  beforeEach(() => {
    fakeFileHandle = setupFakeFileHandle(testFileSize, testNumChunks, testRealChunkSize)
    vi.spyOn(fsPromises, 'open').mockResolvedValue(fakeFileHandle as any)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should orchestrate the multipart upload process using createAxiosInstance', async () => {
    const uploadResponse = { uploadId: testUploadId }
    const axiosInstance: any = createAxiosInstance('put', uploadResponse)

    await utils.uploadFileInParts(
      axiosInstance,
      testFileName,
      testFilePath,
      testFileSize,
      testOrganizationName,
      testMaxChunkSize,
    )

    // Assert: Verify that the Axios instance was called with the expected URLs.
    expect(axiosInstance.put).toHaveBeenCalledTimes(4)
    expect(axiosInstance.put.mock.calls[0][0]).toBe(
      `/organizations/${testOrganizationName}/files/${testFileName}?action=mpu-create`,
    )
    expect(axiosInstance.put.mock.calls[1][0]).toBe(
      `/organizations/${testOrganizationName}/file_parts/${testFileName}?uploadId=${testUploadId}&partNumber=1`,
    )
    expect(axiosInstance.put.mock.calls[2][0]).toBe(
      `/organizations/${testOrganizationName}/file_parts/${testFileName}?uploadId=${testUploadId}&partNumber=2`,
    )
    expect(axiosInstance.put.mock.calls[3][0]).toBe(
      `/organizations/${testOrganizationName}/files/${testFileName}?action=mpu-complete&uploadId=${testUploadId}`,
    )
  })
})
