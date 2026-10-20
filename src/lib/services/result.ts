export type ServiceResult<T> = { ok: true; data: T } | { ok: false; status: number; error: string };

export function ok<T>(data: T): ServiceResult<T> {
  return { ok: true, data };
}

export function fail<T = never>(status: number, error: string): ServiceResult<T> {
  return { ok: false, status, error };
}

/** Who is performing an action: the signed-in user for session routes, the configured account for the assistant. */
export type Actor = { userId: string; email?: string | null };
