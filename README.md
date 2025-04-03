# SaladCloud Transcription SDK for JavaScript and TypeScript

Welcome to the SaladCloud Transcription SDK documentation. This guide will help you get started with integrating and using the SaladCloud Transcription SDK in your project.

## Versions

- SDK version: `0.9.0-alpha.1`

## About the API

The Transcription REST API. Please refer to the [Transcription API Documentation](https://docs.salad.com/reference/transcribe/inference_endpoints/create-an-inference-endpoint-job) for more details.

## Installation

To get started with the SDK, we recommend installing using `npm` or `yarn`:

```bash
npm install @saladtechnologies-oss/salad-cloud-transcription-sdk
```

```bash
yarn add @saladtechnologies-oss/salad-cloud-transcription-sdk
```

## Table of Contents

- [Authentication](#authentication)
  - [Setting the API key](#transcribe)
  - [Setting a Custom Timeout](#get)
- [Sample Usage](#sample-usage)
- [Features and Methods](#features-and-methods)
  - [Transcribe](#transcribe)
  - [Transcribe and Get Updates via a Webhook](#transcribe-and-get-updates-via-a-webhook)
  - [Get](#get)
  - [Stop](#stop)
  - [List](#list)
  - [WaitFor](#waitfor)
- [Error Handling](#error-handling)
- [License](#license)

## Authentication

### API Key Authentication

The SaladCloud Transcription SDK uses API keys as a form of authentication. An API key is a unique identifier used to authenticate a user, developer, or a program that is calling the API.

#### Setting the API key

When you initialize the SDK, you can set the API key as follows:

```ts
const sdk = new SaladCloudTranscriptionSdk({ apiKey: 'YOUR_API_KEY' })
```

## Setting a Custom Timeout

You can set a custom timeout for the SDK's HTTP requests as follows:

```ts
const sdk = new SaladCloudTranscriptionSdk({ timeout: 10000 })
```

## Sample Usage

Below is a comprehensive example demonstrating how to authenticate and transcribe:

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const organizationName = 'organization_name'
const file = 'file_to_path_or_url'

const sdk = new SaladCloudTranscriptionSdk({ apiKey: 'YOUR_API_KEY' })

const transcribe = async (): Promise<string> => {
  const { id } = await sdk.transcribe(organizationName, file)
  return id
}

;(async () => {
  try {
    await transcribe()
  } catch (error) {
    console.error(error)
  }
})()
```

## Features and Methods

The SDK exposes several key methods:

### Transcribe

Transcribes a file or remote source. If a local file is provided, it is uploaded before transcription.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const transcribe = await sdk.transcribe(
  'organization_name', // organization name
  'path_to_file_or_url/video.mp4', // local file or a remote URL
  { language: 'en-US' }, // optional transcription options
  'https://your-webhook-endpoint.com', // optional webhook URL for callbacks
  signal, // optional AbortSignal to cancel the operation
)
```

### Transcribe and Get Updates via a Webhook

Transcribes a file or remote source via a Webhook.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const transcribe = await sdk.transcribe(
  'organization_name',
  'path_to_file_or_url/video.mp4',
  { language: 'en-US' },
  'https://your-webhook-endpoint.com',
)
```

```ts
import { SaladCloudSdk } from '@saladtechnologies-oss/salad-cloud-sdk'
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

// In your webhook handler you need to validate the payload being sent to you:
const handleWebhook = (payload: any): Promise<void> => {
  const saladCloudTranscriptionSdk = new SaladCloudTranscriptionSdk({
    apiKey: 'YOUR_API_KEY',
  })

  const saladCloudSdk = new SaladCloudSdk({
    apiKey: 'YOUR_API_KEY',
  })

  // Extract the signing parameters from the headers.
  const {
    'webhook-signature': webhookSignature,
    'webhook-timestamp': webhookTimestamp,
    'webhook-id': webhookId,
  } = payload.headers

  // Retrieve the webhook signing secret for your organization.
  const getWebhookSecretKeyResponse = await saladCloudSdk.webhookSecretKey.getWebhookSecretKey('organization_name')
  const signingSecret = `whsec_${getWebhookSecretKeyResponse.data?.secretKey}`

  // Process the webhook payload.
  const job = await saladCloudTranscriptionSdk.processWebhookRequest({
    payload,
    signingSecret,
    webhookId,
    webhookTimestamp,
    webhookSignature,
  })

  console.log('Transcription Job:', job.data)
}
```

### Get

Retrieves the current status or result of a transcription job.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const transcription = await sdk.get('organization_name', 'transcription_job_id')
```

### Stop

Stops (cancels) an active transcription job.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

await sdk.stop('organization_name', 'transcription_job_id')
```

### List

Lists all transcription jobs for a given organization.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const transcriptionsList = await sdk.list('organization_name')
```

### WaitFor

Polls the transcription status until the job reaches a final state ("succeeded" or "failed"), a timeout is reached, or the operation is aborted.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

try {
  const finalResult = await sdk.waitFor('organization_name', 'transcription_job_id')
} catch (error) {
  console.error('Error or timeout while waiting:', error)
}
```

## Error Handling

Each method validates the request and response payloads. If an error is detected—for example, a transcription job failure with an error message—the SDK throws an error with a descriptive message. This allows implement custom error handling.

## License

This SDK is licensed under the MIT License.

See the [LICENSE](LICENSE) file for more details.
