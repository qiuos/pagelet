import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { Share } from '@pagelet/shared';
import { appConfig } from '../config';

export function setShareCookie(req: Request, res: Response, share: Share, purpose: 'password' | 'visit'): void {
  const token = jwt.sign({ shareId: share.id, passwordHash: share.passwordHash || '', purpose }, appConfig.jwtSecret, {
    audience: 'pagelet-share', expiresIn: purpose === 'visit' ? '30m' : '24h'
  });
  res.cookie(`share_${purpose}_${share.slug}`, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
    path: `/api/s/${share.slug}`,
    maxAge: purpose === 'visit' ? 30 * 60 * 1000 : 24 * 60 * 60 * 1000
  });
}

export function hasShareCookie(req: Request, share: Share, purpose: 'password' | 'visit'): boolean {
  try {
    const payload = jwt.verify(req.cookies?.[`share_${purpose}_${share.slug}`], appConfig.jwtSecret, {
      audience: 'pagelet-share'
    });
    return typeof payload === 'object' && payload.shareId === share.id &&
      payload.passwordHash === (share.passwordHash || '') && payload.purpose === purpose;
  } catch {
    return false;
  }
}
