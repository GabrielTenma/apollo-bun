import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Interceptor that wraps all successful HTTP responses in a standard JSON envelope.
 * This ensures consistent response formatting across the application.
 * Includes correlation_id for request tracing.
 */
@Injectable()
export class TransformInterceptor implements NestInterceptor {
  /**
   * Intercepts the outgoing response and wraps it in a standard format.
   *
   * @param context - The execution context of the current request.
   * @param next - The call handler that passes control to the next interceptor or route handler.
   * @returns An observable that emits the wrapped response.
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    // Get or generate correlation ID
    const correlationId =
      (request.headers['x-correlation-id'] as string) ||
      (request.headers['x-request-id'] as string) ||
      crypto.randomUUID();

    return next.handle().pipe(
      map((data) => {
        // Check if data is already in standard format (has success property)
        // to avoid double-wrapping
        if (data && typeof data === 'object' && 'success' in data) {
          // Already wrapped, just ensure correlation_id is present
          if (!('correlation_id' in data)) {
            data.correlation_id = correlationId;
          }
          if (!('timestamp' in data)) {
            data.timestamp = new Date().toISOString();
          }
          return data;
        }

        // Wrap with standard format
        return {
          success: true,
          data,
          correlation_id: correlationId,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
