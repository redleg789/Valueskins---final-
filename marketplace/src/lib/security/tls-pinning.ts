import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

const PINNED_CERTIFICATES = {
  production: {
    'valueskins.com': 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    'api.valueskins.com': 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=',
  },
  staging: {
    'staging.valueskins.com': 'sha256/CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC=',
  },
};

export function enforceTLS(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const protocol = req.headers['x-forwarded-proto'] || 'http';

  if (protocol !== 'https') {
    res.status(403).json({ error: 'HTTPS required' });
    return;
  }

  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  next();
}

export function validatePublicKeyPin(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const host = req.headers.host || '';
  const environment = process.env.NODE_ENV === 'production' ? 'production' : 'staging';

  const pinConfig = (PINNED_CERTIFICATES as any)[environment] || {};
  const expectedPin = pinConfig[host];

  if (expectedPin && process.env.NODE_ENV === 'production') {
    const publicKeyPin = req.headers['public-key-pins'];
    if (!publicKeyPin || !publicKeyPin.includes(expectedPin)) {
      res.setHeader('Public-Key-Pins', `pin-sha256="${expectedPin}"; max-age=2592000; includeSubDomains`);
    }
  }

  next();
}

export function verifyCertificateValidity(req: NextApiRequest, res: NextApiResponse, next: () => void) {
  const tlsVersion = req.headers['x-forwarded-proto-version'] || '';

  if (process.env.NODE_ENV === 'production') {
    if (!tlsVersion.includes('1.3') && !tlsVersion.includes('1.2')) {
      res.status(403).json({ error: 'TLS 1.2+ required' });
      return;
    }
  }

  next();
}
