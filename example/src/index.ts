import { SaladCloudTranscriptionSdk } from '@saladtechnologies-oss/salad-cloud-transcription-sdk'

const organizationName = 'organization_name'
const file = 'file_to_path_or_url'

const sdk = new SaladCloudTranscriptionSdk({ apiKey: 'YOUR_API_KEY' })

const transcribe = async (): Promise<string> => {
  const { id } = await sdk.transcribe(organizationName, file)
  return id
}

const waitForTranscriptionOutput = async (): Promise<any> => {
  const transcriptionId = await transcribe()
  console.log('Transcription ID:', transcriptionId)

  const { output } = await sdk.waitFor(organizationName, transcriptionId)
  console.log('Transcription Response Output:', output)
  return output
}

;(async () => {
  try {
    await waitForTranscriptionOutput()
  } catch (error) {
    console.error('Process failed:', error)
  }
})()
