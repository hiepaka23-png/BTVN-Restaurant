import { createHmac, timingSafeEqual } from 'crypto';

// Triển khai tay JWT rút gọn (header.payload.signature, HMAC-SHA256) — dùng cho CẢ access token
// lẫn refresh token, đáp ứng BE-03 (không phụ thuộc @nestjs/jwt / passport-jwt để ký hay xác thực
// token; 2 thư viện đó chỉ còn đóng vai trò optional ở chỗ khác nếu có, không dùng ở đây nữa).

export interface CustomJwtClaims {
  sub: string;
  [key: string]: unknown;
}

interface CustomJwtPayload extends CustomJwtClaims {
  iat: number;
  exp: number;
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64').toString('utf8');
}

function sign(payload: string, secret: string): string {
  return base64UrlEncode(
    createHmac('sha256', secret).update(payload).digest('base64'),
  );
}

export function signCustomJwt(
  claims: CustomJwtClaims,
  secret: string,
  expiresInSeconds: number,
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(
    JSON.stringify({ ...claims, iat: now, exp: now + expiresInSeconds }),
  );
  const signature = sign(`${header}.${payload}`, secret);
  return `${header}.${payload}.${signature}`;
}

export function verifyCustomJwt(
  token: string,
  secret: string,
): CustomJwtPayload | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, payload, signature] = parts;

  const expectedSignature = sign(`${header}.${payload}`, secret);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  let decoded: CustomJwtPayload;
  try {
    decoded = JSON.parse(base64UrlDecode(payload)) as CustomJwtPayload;
  } catch {
    return null;
  }
  if (decoded.exp < Math.floor(Date.now() / 1000)) {
    return null; // hết hạn
  }
  return decoded;
}
