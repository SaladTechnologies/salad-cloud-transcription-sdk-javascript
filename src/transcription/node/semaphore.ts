/**
 * A simple semaphore implementation to limit concurrency.
 */
export class Semaphore {
  private current: number
  private queue: Array<() => void>

  constructor(maxConcurrency: number) {
    this.current = maxConcurrency
    this.queue = []
  }

  async acquire(): Promise<void> {
    if (this.current > 0) {
      this.current--
      return
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve)
    })
  }

  release(): void {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift()
      if (nextResolve) nextResolve()
    } else {
      this.current++
    }
  }
}
