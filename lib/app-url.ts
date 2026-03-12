import 'server-only';

import { APP_BASE_URL } from '@/lib/env';

export async function getAppBaseUrl() {
  return APP_BASE_URL;
}
