import { vi } from 'vitest'

/** Helper to create an axios mock instance **/
export const createAxiosInstance = <T extends 'put' | 'post'>(method: T, response: any, shouldError = false) => {
  const instance = {} as Record<T, any>
  instance[method] = shouldError
    ? vi.fn().mockRejectedValue(new Error(typeof response === 'string' ? response : 'Error'))
    : vi.fn().mockResolvedValue({ data: response })
  return instance
}

/** Helper to setup a fake file handle for fsPromises.open **/
export const setupFakeFileHandle = (totalSize: number, numChunks: number, realChunkSize: number) => {
  let readCalls = 0
  return {
    read: vi.fn().mockImplementation(async (_buffer: Buffer, _offset: number, length: number, _position: number) => {
      readCalls++
      if (readCalls < numChunks) {
        return { bytesRead: length }
      } else {
        return { bytesRead: totalSize - (numChunks - 1) * realChunkSize }
      }
    }),
    close: vi.fn().mockResolvedValue(undefined),
  }
}
