import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

/**
 * Interceptor that logs incoming HTTP requests and their responses.
 * It records the HTTP method, URL, response status code, and the duration
 * of the request processing time in milliseconds.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  /**
   * Intercepts the request/response cycle to log request details and timing.
   *
   * @param context - The execution context providing access to the HTTP request.
   * @param next - The call handler that passes control to the next interceptor or route handler.
   * @returns An observable that completes after the response is sent.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url } = request;
    const now = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        const statusCode = response.statusCode;
        const message = `${method} ${url} ${statusCode} - ${duration}ms`;

        // Log to console
        this.logger.log(message);
      }),
    );
  }
}
