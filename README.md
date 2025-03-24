# SaladCloud Transcription SDK for JavaScript and TypeScript

Welcome to the SaladCloud Transcription SDK documentation. This guide will help you get started with integrating and using the SaladCloud Transcription SDK in your project.

## Versions

- API version: `0.9.0-alpha.8`
- SDK version: `0.9.0-alpha.1`

## About the API

The SaladCloud REST API. Please refer to the [SaladCloud API Documentation](https://docs.salad.com/api-reference) for more details.

## Installation

To get started with the SDK, we recommend installing using `npm`:

```bash
npm install @saladtechnologies-oss/salad-cloud-transcription-sdk
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

# Sample Usage

Below is a comprehensive example demonstrating how to authenticate and transcribe:

```ts
import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const sdk = new SaladCloudTranscriptionSdk({
  apiKey: 'YOUR_API_KEY',
})

const transcribe = async (): Promise<string> => {
  const { id } = await sdk.transcribe('organization_name', 'path_to_file/video.mp4')
  console.log(id)
}

;(async () => {
  await transcribe()
})()
```

## License

This SDK is licensed under the MIT License.

See the [LICENSE](LICENSE) file for more details.
