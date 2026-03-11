export class GlobalNonHttpException extends Error {
  constructor(
    message: string,
    public readonly code?: number,
  ) {
    super(message);
    this.name = 'GlobalNonHttpException';
    // Ensure the name of this error is the same as the class name
    Object.setPrototypeOf(this, GlobalNonHttpException.prototype);
  }

  // Optionally, you can add a method to format the error message
  public formatError(): string {
    return `Error [${this.name}]: ${this.message}${this.code ? ` (Code: ${this.code})` : ''}`;
  }
}
