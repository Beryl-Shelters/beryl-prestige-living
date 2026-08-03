import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";

const CUSTOMER_AUDIENCE = "beryl-customer";

type BaseClaims = {
  sub: string;
  sid: string;
  aud: typeof CUSTOMER_AUDIENCE;
  iat: number;
  exp: number;
};

export type CustomerAccessClaims = BaseClaims & {
  typ: "customer_access";
  ver: number;
};

export type CustomerRefreshClaims = BaseClaims & {
  typ: "customer_refresh";
  jti: string;
};

export class CustomerTokenError extends Error {
  constructor(readonly reason: "INVALID" | "EXPIRED") {
    super(`Customer token ${reason.toLowerCase()}`);
  }
}

const encode = (value: unknown) =>
  Buffer.from(JSON.stringify(value), "utf8").toString("base64url");

const signature = (secret: string, value: string) =>
  createHmac("sha256", secret).update(value, "utf8").digest("base64url");

const sign = (secret: string, claims: CustomerAccessClaims | CustomerRefreshClaims) => {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const payload = encode(claims);
  const unsigned = `${header}.${payload}`;
  return `${unsigned}.${signature(secret, unsigned)}`;
};

const verify = <T extends CustomerAccessClaims | CustomerRefreshClaims>(
  token: string,
  secret: string,
  expectedType: T["typ"],
  now: Date
) => {
  const parts = token.split(".");
  if (parts.length !== 3 || secret.length < 32) {
    throw new CustomerTokenError("INVALID");
  }

  const [headerPart, payloadPart, suppliedSignature] = parts;
  const expectedSignature = signature(secret, `${headerPart}.${payloadPart}`);
  const supplied = Buffer.from(suppliedSignature, "utf8");
  const expected = Buffer.from(expectedSignature, "utf8");

  if (
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  ) {
    throw new CustomerTokenError("INVALID");
  }

  try {
    const header = JSON.parse(Buffer.from(headerPart, "base64url").toString("utf8"));
    const claims = JSON.parse(
      Buffer.from(payloadPart, "base64url").toString("utf8")
    ) as T;

    if (
      header.alg !== "HS256" ||
      header.typ !== "JWT" ||
      claims.aud !== CUSTOMER_AUDIENCE ||
      claims.typ !== expectedType ||
      typeof claims.sub !== "string" ||
      typeof claims.sid !== "string" ||
      typeof claims.iat !== "number" ||
      typeof claims.exp !== "number"
    ) {
      throw new CustomerTokenError("INVALID");
    }

    if (claims.exp <= Math.floor(now.getTime() / 1_000)) {
      throw new CustomerTokenError("EXPIRED");
    }

    return claims;
  } catch (error) {
    if (error instanceof CustomerTokenError) throw error;
    throw new CustomerTokenError("INVALID");
  }
};

export const issueCustomerAccessToken = (input: {
  secret: string;
  userId: string;
  sessionId: string;
  sessionVersion: number;
  expiresIn: number;
  now: Date;
}) => {
  const issuedAt = Math.floor(input.now.getTime() / 1_000);
  return sign(input.secret, {
    sub: input.userId,
    sid: input.sessionId,
    ver: input.sessionVersion,
    aud: CUSTOMER_AUDIENCE,
    typ: "customer_access",
    iat: issuedAt,
    exp: issuedAt + input.expiresIn
  });
};

export const issueCustomerRefreshToken = (input: {
  secret: string;
  userId: string;
  sessionId: string;
  expiresIn: number;
  now: Date;
}) => {
  const issuedAt = Math.floor(input.now.getTime() / 1_000);
  return sign(input.secret, {
    sub: input.userId,
    sid: input.sessionId,
    jti: randomBytes(32).toString("base64url"),
    aud: CUSTOMER_AUDIENCE,
    typ: "customer_refresh",
    iat: issuedAt,
    exp: issuedAt + input.expiresIn
  });
};

export const verifyCustomerAccessToken = (
  token: string,
  secret: string,
  now = new Date()
) => {
  const claims = verify<CustomerAccessClaims>(
    token,
    secret,
    "customer_access",
    now
  );
  if (!Number.isInteger(claims.ver) || claims.ver < 1) {
    throw new CustomerTokenError("INVALID");
  }
  return claims;
};

export const verifyCustomerRefreshToken = (
  token: string,
  secret: string,
  now = new Date()
) => {
  const claims = verify<CustomerRefreshClaims>(
    token,
    secret,
    "customer_refresh",
    now
  );
  if (typeof claims.jti !== "string" || claims.jti.length < 32) {
    throw new CustomerTokenError("INVALID");
  }
  return claims;
};

export const hashToken = (token: string) =>
  createHash("sha256").update(token, "utf8").digest("hex");

export const createResetProof = () => randomBytes(32).toString("base64url");
