import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db/connection';
import { User, RegisterRequest, LoginRequest, AuthResponse } from '../types';

const router = Router();

// POST /api/auth/register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('name').trim().notEmpty().isLength({ min: 2, max: 100 }),
    body('password').isLength({ min: 8 }),
  ],
  async (req: Request<object, object, RegisterRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, name, password } = req.body;

    try {
      // Check if email already exists
      const existing = await pool.query<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0) {
        res.status(409).json({ error: 'Email already registered' });
        return;
      }

      const password_hash = await bcrypt.hash(password, 12);
      const id = uuidv4();

      await pool.query(
        `INSERT INTO users (id, email, name, password_hash, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [id, email, name, password_hash]
      );

      const jwtSecret = process.env.JWT_SECRET!;
      const token = jwt.sign({ id, email }, jwtSecret, { expiresIn: '8h' });

      const response: AuthResponse = {
        token,
        user: { id, email, name },
      };

      res.status(201).json(response);
    } catch (err) {
      console.error('[auth] Register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// POST /api/auth/login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req: Request<object, object, LoginRequest>, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      res.status(400).json({ errors: errors.array() });
      return;
    }

    const { email, password } = req.body;

    try {
      const result = await pool.query<User>(
        'SELECT * FROM users WHERE email = $1',
        [email]
      );
      const user = result.rows[0];

      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Update last_login_at
      await pool.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [user.id]
      );

      const jwtSecret = process.env.JWT_SECRET!;
      const token = jwt.sign(
        { id: user.id, email: user.email },
        jwtSecret,
        { expiresIn: '8h' }
      );

      const response: AuthResponse = {
        token,
        user: { id: user.id, email: user.email, name: user.name },
      };

      res.json(response);
    } catch (err) {
      console.error('[auth] Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

export default router;
