/**
 * Enum representing translation languages.
 */
export enum TranslationLanguage {
  German = 'german',
  Italian = 'italian',
  French = 'french',
  Spanish = 'spanish',
  English = 'english',
  Portuguese = 'portuguese',
  Hindi = 'hindi',
  Thai = 'thai',
}

/**
 * Enum representing status.
 */
export enum Status {
  Succeeded = 'succeeded',
  Failed = 'failed',
  Pending = 'pending',
  Running = 'running',
}

/**
 * Enum representing event action.
 */
export enum EventAction {
  CREATED = 'created',
  STARTED = 'started',
  SUCCEEDED = 'succeeded',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/**
 * Transcription SDK config.
 */
export interface SaladCloudTranscriptionSdkConfig {
  apiKey: string
  timeoutMs?: number
}

/**
 * Get transcription interface.
 */
export interface GetTranscriptionRequest {
  transcriptionId: string
  organizationName: string
}

/**
 * List transcriptions interface.
 */
export interface ListTranscriptionsRequest {
  organizationName: string
}

/**
 *  Transcribe options.
 */
export interface TranscribeOptions {
  returnAsFile?: boolean
  languageCode?: string
  translate?: string
  sentenceLevelTimestamps?: boolean
  wordLevelTimestamps?: boolean
  diarization?: boolean
  sentenceDiarization?: boolean
  srt?: boolean
  summarize?: number
  llmTranslation?: TranslationLanguage[]
  srtTranslation?: TranslationLanguage[]
  customVocabulary?: string
  customPrompt?: string
  overallSentimentAnalysis?: boolean
  overallClassification?: boolean
}

/**
 * Transcribe request interface.
 */
export interface TranscribeRequest {
  source: string
  organizationName: string
  options?: TranscribeOptions
  webhookUrl?: string
}

/**
 * Transcribe response interface.
 */
export interface TranscribeResponse {
  id: string
  input: {
    url: string
    languageCode?: string
    returnAsFile?: boolean
    wordLevelTimestamps?: boolean
    diarization?: boolean
    sentenceDiarization?: boolean
    srt?: boolean
    translate?: string
    llmTranslation?: string
    srtTranslation?: string
    customPrompt?: string
    customVocabulary?: string
    sentenceLevelTimestamps?: boolean
    summarize?: number
    overallClassification?: boolean
    overallSentimentAnalysis?: boolean
  }
  inferenceEndpointName: string
  metadata?: Record<string, any>
  status: Status
  events: Array<{
    action: string
    time: string
  }>
  organizationName: string
  output?:
    | {
        text: string
        durationInSeconds: number
        duration: number
        processingTime: number
      }
    | {
        url: string
        durationInSeconds: number
        duration: number
        processingTime: number
      }
  createTime: string
  updateTime: string
}

/**
 * List transcription response interface.
 */
export interface ListTranscriptionsResponse {
  items: TranscribeResponse[]
}
