import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global HTTP exception filter that catches all exceptions (HTTP and non-HTTP)
 * and transforms them into a consistent JSON response structure.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  /**
   * Catches and processes exceptions thrown during request handling.
   *
   * @param exception - The exception thrown by the application.
   * @param host - The arguments host providing access to the HTTP context.
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Normalize the message to always be a string or string array
    const normalizedMessage =
      typeof message === 'object' && message !== null && 'message' in message
        ? (message as { message: string | string[] }).message
        : exception instanceof HttpException
        ? (message as string)
        : 'Internal server error';

    // Get or generate correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      crypto.randomUUID();

    const errorResponse = {
      success: false,
      data: null,
      message: normalizedMessage,
      correlation_id: correlationId,
      timestamp: new Date().toISOString(),
      statusCode: status,
    };

    // Log server errors
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json(errorResponse);
  }
}
