export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INTERNAL_SERVER_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  | 'CSRF_INVALID'
  | 'BAD_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'SERVICE_UNAVAILABLE';

export interface ApiErrorEnvelope {
  error: {
    code: ApiErrorCode;
    message: string;
    requestId?: string;
  };
}
