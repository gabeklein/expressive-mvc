export class HttpError extends Error {
  status = 500;
}

export class BadRequest extends HttpError {
  status = 400;
}

export class Unauthorized extends HttpError {
  status = 401;
}

export class PaymentRequired extends HttpError {
  status = 402;
}

export class Forbidden extends HttpError {
  status = 403;
}

export class NotFound extends HttpError {
  status = 404;
}

export class MethodNotAllowed extends HttpError {
  status = 405;
}

export class Conflict extends HttpError {
  status = 409;
}

export class Gone extends HttpError {
  status = 410;
}

export class PayloadTooLarge extends HttpError {
  status = 413;
}

export class UnprocessableEntity extends HttpError {
  status = 422;
}

export class TooManyRequests extends HttpError {
  status = 429;
}

export class InternalError extends HttpError {
  status = 500;
}

export class NotImplemented extends HttpError {
  status = 501;
}

export class ServiceUnavailable extends HttpError {
  status = 503;
}

export class Redirect extends HttpError {
  constructor(
    public location: string,
    public status = 302,
  ) {
    super(location);
  }
}

export const ERRORS: Record<string, new (message: string) => Error> = {
  "http:HttpError": HttpError,
  "http:BadRequest": BadRequest,
  "http:Unauthorized": Unauthorized,
  "http:PaymentRequired": PaymentRequired,
  "http:Forbidden": Forbidden,
  "http:NotFound": NotFound,
  "http:MethodNotAllowed": MethodNotAllowed,
  "http:Conflict": Conflict,
  "http:Gone": Gone,
  "http:PayloadTooLarge": PayloadTooLarge,
  "http:UnprocessableEntity": UnprocessableEntity,
  "http:TooManyRequests": TooManyRequests,
  "http:InternalError": InternalError,
  "http:NotImplemented": NotImplemented,
  "http:ServiceUnavailable": ServiceUnavailable,
  "http:Redirect": Redirect,
};

for (const [id, Type] of Object.entries(ERRORS)) Type.prototype.name = id.slice(5);
