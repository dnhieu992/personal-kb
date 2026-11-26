import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Problem } from '@pkb/contracts';
import type { Response } from 'express';
import { isCheckViolation, isDuplicate, isRowReferenced } from '../database/db-errors';
import { ZodValidationException } from './zod.pipe';

/** Every error leaves the API as an RFC 7807 problem document. */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger('Problem');

  catch(e: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const p = this.toProblem(e);
    if (p.status >= 500) this.logger.error(e instanceof Error ? e.stack ?? e.message : String(e));
    res.status(p.status).type('application/problem+json').json(p);
  }

  private toProblem(e: unknown): Problem {
    if (e instanceof ZodValidationException) {
      return { type: 'validation', title: 'Validation failed', status: 400, errors: e.issues };
    }
    if (e instanceof HttpException) {
      const status = e.getStatus();
      const body = e.getResponse();
      const msg = typeof body === 'string' ? body : (body as { message?: string | string[] }).message;
      return {
        type: HttpStatus[status]?.toLowerCase() ?? 'error',
        title: HttpStatus[status] ? HttpStatus[status].replace(/_/g, ' ').toLowerCase() : 'Error',
        status,
        detail: Array.isArray(msg) ? msg.join('; ') : msg ?? e.message,
      };
    }
    if (isRowReferenced(e)) {
      return { type: 'conflict', title: 'In use', status: 409, detail: 'This item is still referenced by other items — move or delete those first.' };
    }
    if (isDuplicate(e)) {
      return { type: 'conflict', title: 'Duplicate', status: 409, detail: 'An item with the same unique value already exists.' };
    }
    if (isCheckViolation(e)) {
      return { type: 'validation', title: 'Invalid state', status: 400, detail: 'The change violates a data rule.' };
    }
    return { type: 'internal', title: 'Internal error', status: 500 };
  }
}
