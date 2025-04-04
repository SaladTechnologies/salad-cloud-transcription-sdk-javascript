import { describe, expect, it } from 'vitest'
import { TranslationLanguage } from '../src/transcription/types'
import { isRemoteFile, transformTranscribeRequest } from '../src/transcription/utils'
import { testOrganizationName, testUrl } from './shared'

describe('transformTranscribeRequest', () => {
  it('should transform a request with translation arrays and preserve extra fields', () => {
    const transcribeRequest = {
      source: testUrl,
      organizationName: testOrganizationName,
      options: {
        llmTranslation: [TranslationLanguage.English, TranslationLanguage.French],
        srtTranslation: [TranslationLanguage.Spanish],
      },
      extraField: 'extraValue',
    }

    const transformed = transformTranscribeRequest(transcribeRequest)

    expect(transformed).toEqual({
      extraField: 'extraValue',
      input: {
        url: testUrl,
        llm_translation: `${TranslationLanguage.English}, ${TranslationLanguage.French}`,
        srt_translation: `${TranslationLanguage.Spanish}`,
      },
    })
  })

  it('should transform a request without options', () => {
    const transcribeRequest = {
      source: testUrl,
      organizationName: testOrganizationName,
      extraField: 'extraValue',
    }

    const transformed = transformTranscribeRequest(transcribeRequest)
    expect(transformed).toEqual({
      extraField: 'extraValue',
      input: {
        url: testUrl,
      },
    })
  })

  it('should transform a request with options missing translation arrays', () => {
    const transcribeRequest = {
      source: testUrl,
      organizationName: testOrganizationName,
      options: {
        returnAsFile: true,
      },
      extraField: 'extraValue',
    }

    const transformed = transformTranscribeRequest(transcribeRequest)
    expect(transformed).toEqual({
      extraField: 'extraValue',
      input: {
        url: testUrl,
        returnAsFile: true,
        llm_translation: undefined,
        srt_translation: undefined,
      },
    })
  })
})

describe('isRemoteFile', () => {
  it('should return true for http URLs', () => {
    expect(isRemoteFile('http://example.com/file.mp3')).toBe(true)
  })

  it('should return true for https URLs', () => {
    expect(isRemoteFile('https://example.com/file.mp3')).toBe(true)
  })

  it('should return true for ftp URLs', () => {
    expect(isRemoteFile('ftp://example.com/file.mp3')).toBe(true)
  })

  it('should return false for file URLs', () => {
    expect(isRemoteFile('file:///tmp/file.mp3')).toBe(false)
  })

  it('should return false for local file paths', () => {
    expect(isRemoteFile('/local/path/file.mp3')).toBe(false)
  })

  it('should return false for invalid URL strings', () => {
    expect(isRemoteFile('not-a-url')).toBe(false)
  })
})
