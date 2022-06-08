export class AutoPollingAlreadyStartedError extends Error {
  constructor() {
    super("Auto polling already started");
    this.name = "AutoPollingAlreadyStartedError";
  }
}

export class BufferMaxSizeExceeded extends Error {
  constructor() {
    super("Queue max size reached");
    this.name = "BufferMaxSizeExceeded";
  }
}
