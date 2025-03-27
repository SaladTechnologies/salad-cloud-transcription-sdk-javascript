import { SaladCloudSdk } from '@saladtechnologies-oss/salad-cloud-sdk'
import axios, { AxiosInstance } from 'axios'
import { oneMinuteInMs, oneSecondInMs, transcribeInferenceEndpointName } from './constants'
import { getTranscriptionLocalFileSource } from './node'
import {
  GetTranscriptionRequestSchema,
  ListTranscriptionsRequestSchema,
  ListTranscriptionsResponseSchema,
  ProcessWebhookRequestSchema,
  TranscribeRequestSchema,
  TranscribeResponseSchema,
} from './schema'
import {
  GetTranscriptionRequest,
  ListTranscriptionsResponse,
  ProcessWebhookRequest,
  SaladCloudTranscriptionSdkConfig,
  Status,
  TranscribeOptions,
  TranscribeRequest,
  TranscribeResponse,
} from './types'
import { checkIfUrlDownloadable, transformTranscribeRequest } from './utils'
import { Webhook } from './webhook'

export class SaladCloudTranscriptionSdk {
  private saladCloudSdk: SaladCloudSdk
  private axiosInstance: AxiosInstance

  constructor(config: SaladCloudTranscriptionSdkConfig) {
    if (!config.apiKey) {
      throw new Error('SDK initialization requires an apiKey.')
    }
    this.saladCloudSdk = new SaladCloudSdk({
      apiKey: config.apiKey,
      timeoutMs: config.timeoutMs,
    })
    this.axiosInstance = axios.create({
      baseURL: 'https://storage-api.salad.com',
      headers: {
        'Salad-Api-Key': config.apiKey,
      },
    })
  }
  /**
   * Transcribes a file or remote source.
   *
   * @param organizationName - The organization name.
   * @param source - A local file path or a remote URL.
   * @param options - Optional transcription options.
   * @param webhookUrl - Optional webhook URL for callbacks.
   * @returns A promise that resolves to the validated transcription response.
   */
  async transcribe(
    organizationName: string,
    source: string,
    options?: TranscribeOptions,
    webhookUrl?: string,
  ): Promise<TranscribeResponse> {
    let transcriptionSource: string
    if (isRemoteFile(source)) {
      transcriptionSource = source
    } else {
      try {
        transcriptionSource = await getTranscriptionLocalFileSource(this.axiosInstance, source, organizationName)
      } catch (error) {
        throw error
      }
    }

    const isUrlDownloadable = await checkIfUrlDownloadable(transcriptionSource)

    if (isUrlDownloadable) {
      // Build the transcription request.
      const request: TranscribeRequest = {
        organizationName,
        source: transcriptionSource,
        options,
        webhookUrl,
      }

      // Validate the request payload.
      const validRequest = TranscribeRequestSchema.parse(request)
      const transformedRequest = transformTranscribeRequest(validRequest)

      try {
        // Send the transcription request.
        const response = await this.saladCloudSdk.inferenceEndpoints.createInferenceEndpointJob(
          validRequest.organizationName,
          transcribeInferenceEndpointName,
          transformedRequest,
        )
        // Validate and return the response payload.
        return TranscribeResponseSchema.parse(response.data)
      } catch (error) {
        throw error
      }
    } else {
      throw new Error('URL is not downloadable or not publicly accessible')
    }
  }

  /**
   * Retrieves the current status or result of a transcription job.
   *
   * @param organizationName - The organization name.
   * @param transcriptionId - The unique identifier for the transcription job.
   * @returns A promise that resolves to a validated TranscribeResponse.
   */
  async get(organizationName: string, transcriptionId: string): Promise<TranscribeResponse> {
    const request: GetTranscriptionRequest = { organizationName, transcriptionId }

    // Validate the request payload.
    const validRequest = GetTranscriptionRequestSchema.parse(request)

    try {
      // Retrieve the job using SaladCloudSdk.
      const response = await this.saladCloudSdk.inferenceEndpoints.getInferenceEndpointJob(
        validRequest.organizationName,
        transcribeInferenceEndpointName,
        validRequest.transcriptionId,
      )
      const { data } = response
      // Validate and return the response payload.
      return TranscribeResponseSchema.parse(data)
    } catch (error: any) {
      throw error
    }
  }

  /**
   * Lists all transcription jobs for a given organization.
   *
   * @param organizationName - The organization name.
   * @returns A promise that resolves to a validated ListTranscriptionsResponse.
   */
  async list(organizationName: string): Promise<ListTranscriptionsResponse> {
    // Validate the list request payload.
    const validRequest = ListTranscriptionsRequestSchema.parse({ organizationName })

    try {
      const response = await this.saladCloudSdk.inferenceEndpoints.listInferenceEndpointJobs(
        validRequest.organizationName,
        transcribeInferenceEndpointName,
      )
      const { data } = response
      // Validate and return the list response.
      return ListTranscriptionsResponseSchema.parse(data)
    } catch (error: any) {
      throw error
    }
  }

  /**
   * Processes a webhook request.
   *
   * @param payload - The raw payload received from the webhook request.
   * @param base64Secret - The base64 encoded secret used for signature verification.
   * @param webhookId - The unique identifier provided in the webhook.
   * @param webhookTimestamp - The timestamp provided in the webhook.
   * @param webhookSignature - The signature provided in the webhook.
   * @returns A promise that resolves to the result of the webhook verification.
   */
  async processWebhookRequest(
    payload: any,
    base64Secret: string,
    webhookId: string,
    webhookTimestamp: string,
    webhookSignature: string,
  ): Promise<unknown> {
    const request: ProcessWebhookRequest = {
      payload,
      base64Secret,
      webhookId,
      webhookTimestamp,
      webhookSignature,
    }

    // Validate the request payload.
    const validRequest = ProcessWebhookRequestSchema.parse(request)

    const webhookHeaders = {
      'webhook-id': validRequest.webhookId,
      'webhook-timestamp': validRequest.webhookTimestamp,
      'webhook-signature': validRequest.webhookSignature,
    }

    const wh = new Webhook(validRequest.base64Secret)
    return wh.verify(validRequest.payload, webhookHeaders)
  }

  /**
   * Polls the transcription status until a final state is reached.
   *
   * This method continuously polls the status endpoint until the job reaches a
   * final state ("succeeded" or "failed"), the timeout is reached, or the operation is aborted.
   *
   * @param organizationName - The organization name.
   * @param transcriptionId - The unique transcription identifier.
   * @param signal - *(Optional)* An AbortSignal to cancel the polling operation.
   * @returns A promise that resolves to a validated TranscribeResponse.
   */
  async waitFor(organizationName: string, transcriptionId: string, signal?: AbortSignal): Promise<TranscribeResponse> {
    const startTime = Date.now()

    // Validate the get request payload.
    const request: GetTranscriptionRequest = { organizationName, transcriptionId }
    const validRequest = GetTranscriptionRequestSchema.parse(request)

    // Define the polling function.
    const poll = async (): Promise<TranscribeResponse> => {
      if (signal?.aborted) {
        throw new Error('Operation aborted')
      }
      if (Date.now() - startTime > oneMinuteInMs * 2) {
        throw new Error('Timeout waiting for transcription')
      }

      const response = await this.saladCloudSdk.inferenceEndpoints.getInferenceEndpointJob(
        validRequest.organizationName,
        transcribeInferenceEndpointName,
        validRequest.transcriptionId,
      )
      const { data } = response
      // Validate the response payload.
      const validResponse = TranscribeResponseSchema.parse(data)

      // Return the response if the job is complete.
      if (validResponse.status === Status.Succeeded || validResponse.status === Status.Failed) {
        return validResponse
      }

      // Otherwise, wait and poll again.
      await new Promise((resolve) => setTimeout(resolve, oneSecondInMs * 3))
      return poll()
    }

    try {
      return poll()
    } catch (error) {
      throw error
    }
  }
}
