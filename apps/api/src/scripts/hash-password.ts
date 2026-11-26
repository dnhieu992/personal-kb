import { hashPassword } from '../platform/auth/password';

/** Usage: node dist/scripts/hash-password.js 'my password'  → paste into AUTH_PASSWORD_HASH */
const pw = process.argv[2];
if (!pw) {
  console.error("Usage: node dist/scripts/hash-password.js '<password>'");
  process.exit(1);
}
hashPassword(pw).then((h) => console.log(h));
