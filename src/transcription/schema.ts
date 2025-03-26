import { z } from 'zod'
import { Status, TranslationLanguage } from './types'

export const GetTranscriptionRequestSchema = z
  .object({
    transcriptionId: z.string(),
    organizationName: z.string(),
  })
  .strict()

export const ListTranscriptionsRequestSchema = z
  .object({
    organizationName: z.string(),
  })
  .strict()

export const TranscribeRequestSchema = z
  .object({
    source: z.string().url().describe('URL or file path'),
    organizationName: z.string(),
    options: z
      .object({
        returnAsFile: z.boolean().optional(),
        languageCode: z.string().optional(),
        translate: z.string().optional(),
        sentenceLevelTimestamps: z.boolean().optional(),
        wordLevelTimestamps: z.boolean().optional(),
        diarization: z.boolean().optional(),
        sentenceDiarization: z.boolean().optional(),
        srt: z.boolean().optional(),
        summarize: z.number().optional(),
        llmTranslation: z.array(z.nativeEnum(TranslationLanguage)).optional(),
        srtTranslation: z.array(z.nativeEnum(TranslationLanguage)).optional(),
        customVocabulary: z.string().optional(),
        customPrompt: z.string().optional(),
        classificationLabels: z.string().optional(),
        overallSentimentAnalysis: z.boolean().optional(),
        overallClassification: z.boolean().optional(),
      })
      .transform((data) => ({
        return_as_file: data.returnAsFile,
        language_code: data.languageCode,
        translate: data.translate,
        sentence_level_timestamps: data.sentenceLevelTimestamps,
        word_level_timestamps: data.wordLevelTimestamps,
        diarization: data.diarization,
        sentence_diarization: data.sentenceDiarization,
        srt: data.srt,
        summarize: data.summarize,
        llm_translation: data.llmTranslation,
        srt_translation: data.srtTranslation,
        custom_vocabulary: data.customVocabulary,
        custom_prompt: data.customPrompt,
        overall_sentiment_analysis: data.classificationLabels,
        classification_labels: data.overallSentimentAnalysis,
        overall_classification: data.overallClassification,
      }))
      .optional(),
    webhookUrl: z.string().url().optional().describe('Webhook URL to receive transcription updates.'),
  })
  .strict()

export const TranscribeResponseSchema = z
  .object({
    id: z.string(),
    input: z.object({
      url: z.string().url(),
      language_code: z.string().optional(),
      return_as_file: z.boolean().optional(),
      word_level_timestamps: z.boolean().optional(),
      diarization: z.boolean().optional(),
      sentence_diarization: z.boolean().optional(),
      srt: z.boolean().optional(),
      translate: z.string().optional(),
      llm_translation: z.string().optional(),
      srt_translation: z.string().optional(),
      custom_prompt: z.string().optional(),
      custom_vocabulary: z.string().optional(),
      sentence_level_timestamps: z.boolean().optional(),
      summarize: z.number().optional(),
      overall_classification: z.boolean().optional(),
      overall_sentiment_analysis: z.boolean().optional(),
      classification_labels: z.string().optional(),
    }),
    inferenceEndpointName: z.string(),
    metadata: z.record(z.any()).optional(),
    status: z.nativeEnum(Status),
    events: z.array(
      z.object({
        action: z.string(),
        time: z.string(),
      }),
    ),
    organizationName: z.string(),
    output: z
      .union([
        z.object({
          text: z.string(),
          duration_in_seconds: z.number(),
          duration: z.number(),
          processing_time: z.number(),
        }),
        z.object({
          url: z.string().url(),
          duration_in_seconds: z.number(),
          duration: z.number(),
          processing_time: z.number(),
        }),
      ])
      .optional(),
    createTime: z.string(),
    updateTime: z.string(),
  })
  .transform((data) => ({
    id: data.id,
    input: {
      url: data.input.url,
      languageCode: data.input.language_code,
      returnAsFile: data.input.return_as_file,
      wordLevelTimestamps: data.input.word_level_timestamps,
      diarization: data.input.diarization,
      sentenceDiarization: data.input.sentence_diarization,
      srt: data.input.srt,
      translate: data.input.translate,
      llmTranslation: data.input.llm_translation,
      srtTranslation: data.input.srt_translation,
      customPrompt: data.input.custom_prompt,
      customVocabulary: data.input.custom_vocabulary,
      sentenceLevelTimestamps: data.input.sentence_level_timestamps,
      summarize: data.input.summarize,
      classificationLabels: data.input.classification_labels,
      overallClassification: data.input.overall_classification,
      overallSentimentAnalysis: data.input.overall_sentiment_analysis,
    },
    inferenceEndpointName: data.inferenceEndpointName,
    metadata: data.metadata,
    status: data.status,
    events: data.events.map((event) => ({
      action: event.action,
      time: event.time,
    })),
    organizationName: data.organizationName,
    output: data.output
      ? 'text' in data.output
        ? {
            text: data.output.text,
            durationInSeconds: data.output.duration_in_seconds,
            duration: data.output.duration,
            processingTime: data.output.processing_time,
          }
        : {
            url: data.output.url,
            durationInSeconds: data.output.duration_in_seconds,
            duration: data.output.duration,
            processingTime: data.output.processing_time,
          }
      : undefined,
    createTime: data.createTime,
    updateTime: data.updateTime,
  }))

export const ListTranscriptionsResponseSchema = z.object({
  items: z.array(TranscribeResponseSchema),
})

export const ProcessWebhookRequestSchema = z
  .object({
    payload: z.any(),
    base64Secret: z.string(),
    webhookId: z.string(),
    webhookTimestamp: z.string(),
    webhookSignature: z.string(),
  })
  .strict()
