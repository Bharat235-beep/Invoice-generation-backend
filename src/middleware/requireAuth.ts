import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
  const payload = jwt.verify(token, process.env.JWT_SECRET as string);

  if (typeof payload === 'string' || (payload.role !== 'admin' && payload.role !== 'demo')) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  res.locals.role = payload.role;
  next();
} catch {
  return res.status(401).json({ error: 'Invalid or expired token' });
}
}
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (res.locals.role !== 'admin') {
    return res.status(403).json({ error: 'Read-only demo account' });
  }
  next();
}
export default requireAuth;