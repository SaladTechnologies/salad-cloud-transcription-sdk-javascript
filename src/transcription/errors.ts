/**
 * Base custom error class.
 */
export class CustomError extends Error {
  constructor(message: string) {
    super(message)
    // Fix the prototype chain for instanceof checks.
    Object.setPrototypeOf(this, new.target.prototype)
    this.name = new.target.name
  }
}

/**
 * Custom error type for transcription job failures.
 */
export class TranscriptionError extends CustomError {
  constructor(
    public jobId: string,
    public errorMessage: string,
  ) {
    super(`Transcription job ${jobId} failed due to: ${errorMessage}`)
  }
}

/**
 * Custom error type for file upload failures.
 */
export class UploadError extends CustomError {
  constructor(
    public fileName: string,
    public errorMessage: string,
  ) {
    super(`Upload of file "${fileName}" failed: ${errorMessage}`)
  }
}

/**
 * Custom error type for file sign failures.
 */
export class SignFileError extends CustomError {
  constructor(
    public fileName: string,
    public errorMessage: string,
  ) {
    super(`Signing file "${fileName}" failed: ${errorMessage}`)
  }
}
