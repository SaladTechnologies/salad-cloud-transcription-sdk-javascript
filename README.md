# SaladCloud Transcription SDK for JavaScript and TypeScript

Welcome to the SaladCloud Transcription SDK documentation. This guide will help you get started with integrating and using the SaladCloud Transcription SDK in your project.

## Versions

- SDK version: `0.9.0-alpha.1`

## About the API

The Transcription REST API. Please refer to the [Transcription API Documentation](https://docs.salad.com/reference/transcribe/inference_endpoints/create-an-inference-endpoint-job) for more details.

## Table of Contents

- [Getting Started](#getting-started)
- [Installation](#installation)
- [Authentication](#authentication)
  - [Setting the API key](#setting-the-api-key)
  - [Setting a Custom Timeout](#setting-a-custom-timeout)
- [Environment Support](#environment-support)
- [Sample Usage](#sample-usage)
  - [Node.js Usage Example](#node.js-usage-example)
  - [Browser Usage Example](#browser-usage-example)
- [Features and Methods](#features-and-methods)
  - [Transcribe](#transcribe)
  - [Transcribe and Get Updates via a Webhook](#transcribe-and-get-updates-via-a-webhook)
  - [Get](#get)
  - [Stop](#stop)
  - [List](#list)
  - [WaitFor](#waitfor)
- [Error Handling](#error-handling)
- [License](#license)

## Getting Started

To quickly integrate the SDK, follow these steps:

1.  Install the SDK (see above).
2.  Initialize the SDK with your API key.
3.  Transcribe a File using a basic example provided below.

## Installation

To get started with the SDK, we recommend installing using `npm` or `yarn`:

```bash
npm install @saladtechnologies-oss/salad-cloud-transcription-sdk
```

```bash
yarn add @saladtechnologies-oss/salad-cloud-transcription-sdk
```

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

## Environment Support

The SaladCloud Transcription SDK is built to work seamlessly in both Node.js and browser environments.

- Node.js:
  Full support for local file operations and heavy file I/O makes the SDK ideal for server-side applications and CLI tools.

- Browser Limitations:
  Browsers do not have access to the local file system like Node.js does. Therefore, any attempt to perform local file I/O in the browser will be explicitly rejected.

## Sample Usage

Below is a comprehensive example demonstrating how to authenticate and transcribe:

### Node.js Usage Example

```ts
const { SaladCloudTranscriptionSdk } = require('@saladtechnologies-oss/salad-cloud-transcription-sdk')

const organizationName = 'organization_name'
const file = 'file:///path/to/file.mp4'

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

### Browser Usage Example

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const organizationName = 'organization_name'
const file = 'https://example.com/video.mp4'

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

Transcribes either a local file or a remote source.
If you provide a local file, it’s uploaded before transcription. Files larger than 100 MB are uploaded in chunks

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const controller = new AbortController()
const signal = controller.signal

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

const controller = new AbortController()
const signal = controller.signal

const transcribe = await sdk.transcribe(
  'organization_name',
  'path_to_file_or_url/video.mp4',
  { language: 'en-US' },
  'https://your-webhook-endpoint.com',
  signal,
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

const controller = new AbortController()
const signal = controller.signal

const transcription = await sdk.get(
  'organization_name', // organization name
  'transcription_job_id', // transcription job ID
  signal, // optional AbortSignal to cancel the operation
)
```

### Stop

Stops (cancels) an active transcription job.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

await sdk.stop(
  'organization_name', // organization name
  'transcription_job_id', // transcription job ID
)
```

### List

Lists all transcription jobs for a given organization.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const transcriptionsList = await sdk.list(
  'organization_name', // organization name
)
```

### WaitFor

Polls the transcription status until the job reaches a final state ("succeeded" or "failed"), times out at 3 minutes, or the operation is aborted.

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

try {
  const controller = new AbortController()
  const signal = controller.signal

  const finalResult = await sdk.get(
    'organization_name', // organization name
    'transcription_job_id', // transcription job ID
    signal, // optional AbortSignal to cancel the operation
  )
} catch (error) {
  console.error('Error or timeout while waiting:', error)
}
```

## Error Handling

Each method validates the request and response payloads. If an error is detected—for example, a transcription job failure with an error message—the SDK throws an error with a descriptive message. This allows implement custom error handling.

## License

This SDK is licensed under the MIT License.

See the [LICENSE](LICENSE) file for more details.
