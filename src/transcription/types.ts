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
 * Stop (cancel) transcription interface.
 */
export interface StopTranscriptionRequest {
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
 * Transcribe options.
 */
export interface TranscribeOptions {
  /**
   * Set to "true" to receive the transcription output as a downloadable file URL, especially useful for large responses.
   * Set to "false" (default) to receive the full transcription in the API response.
   */
  returnAsFile?: boolean
  /**
   * Transcription is available in 97 languages. We automatically identify the source language.
   * In order to make diarization more accurate, please provide your transcription language.
   * Note: If the response exceeds 1 MB in size, it will automatically be returned as a link to a file, regardless of the returnAsFile setting.
   */
  languageCode?: string
  /**
   * To enable translation, you need to specify the following parameter: "translate": "to_eng".
   * When using translation, you can still add other options.
   * Note: If you use translation, the original transcription is not returned.
   * Translation is currently available for translation from a single language to English only.
   */
  translate?: string
  /**
   * Sentence level timestamps are returned by default. Set to "false" if not needed.
   */
  sentenceLevelTimestamps?: boolean
  /**
   * Set to "true" for word level timestamps. Set to "false" by default.
   */
  wordLevelTimestamps?: boolean
  /**
   * Set to "true" for speaker separation and identification. Set to "false" by default.
   * Diarization requires the languageCode to be defined. By default, it is set to "en" (English).
   */
  diarization?: boolean
  /**
   * Set to "true" to return speaker information at the sentence level.
   * If several speakers are identified in one sentence, the most prominent one will be returned.
   * Set to "false" by default.
   */
  sentenceDiarization?: boolean
  /**
   * Set to "true" to generate a .srt output for captions and subtitles. Set to "false" by default.
   */
  srt?: boolean
  /**
   * Set to a positive integer to receive a summary of the transcription in the specified number of words or less.
   * For example, "summarize": 100 will provide a summary of up to 100 words.
   * Set to 0 (default) if summarization is not needed.
   */
  summarize?: number
  /**
   * Leverage our new LLM integration to translate the transcription between multiple languages.
   * Provide a comma-separated list of target languages in English.
   */
  llmTranslation?: TranslationLanguage[]
  /**
   * Use our LLM integration to translate the generated SRT captions into multiple languages.
   * Provide a comma-separated list of target languages in English, similar to llmTranslation.
   */
  srtTranslation?: TranslationLanguage[]
  /**
   * Provide a comma-separated list of terms or phrases that are specific to your transcription context.
   * This helps improve transcription accuracy for domain-specific terminology.
   */
  customVocabulary?: string
  /**
   * Provide a custom instruction for the LLM to perform a specific task on the transcription,
   * such as grammar improvement or text style change.
   */
  customPrompt?: string
  /**
   * Classification labels.
   */
  classificationLabels?: string
  /**
   * Use the classificationLabels parameter in conjunction with overallClassification to classify the entire transcription
   * into specified categories using an LLM.
   */
  overallClassification?: boolean
  /**
   * Set to "true" to perform sentiment analysis.
   */
  overallSentimentAnalysis?: boolean
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
    classificationLabels?: string
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
    | {
        error: string
        duration: number
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
