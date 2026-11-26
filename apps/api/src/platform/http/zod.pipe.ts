import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationException extends BadRequestException {
  constructor(public readonly issues: { path: string; message: string }[]) {
    super('Validation failed');
  }
}

/** Parses a request part against a contracts schema. Usage: @Body(new ZodPipe(CreateTaskInput)). */
export class ZodPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}
  transform(value: unknown): T {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      throw new ZodValidationException(
        r.error.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message })),
      );
    }
    return r.data;
  }
}
