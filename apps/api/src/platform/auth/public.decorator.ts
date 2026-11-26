import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';
/** Opt a route out of the global auth guard. Default is closed: forgetting this = blocked, not leaked. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
