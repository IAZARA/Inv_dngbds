export class AppError extends Error {
  public readonly statusCode: number;
  public readonly expose: boolean;

  constructor(message: string, statusCode = 500, expose = false) {
    super(message);
    this.statusCode = statusCode;
    this.expose = expose;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}
