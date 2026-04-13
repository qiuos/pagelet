import jwt from 'jsonwebtoken';
import { appConfig } from '../config';

export interface JwtPayload {
  userId: string;
  username: string;
  role: string;
}

export function generateToken(payload: JwtPayload): string {
  return jwt.sign(payload, appConfig.jwtSecret, {
    expiresIn: appConfig.jwtExpiresIn
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, appConfig.jwtSecret, {
    expiresIn: appConfig.refreshTokenExpiresIn
  } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, appConfig.jwtSecret) as JwtPayload;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token);
    if (decoded && typeof decoded === 'object') {
      return decoded as JwtPayload;
    }
    return null;
  } catch {
    return null;
  }
}