import { Router, Request, Response, NextFunction } from 'express';
import {
  getAllListings,
  createListing,
  updateListing,
  getAllExitRoutes,
  upsertExitRoute,
  getAirlineStatuses,
  getLastSync,
} from '../lib/db';
import { runSync } from '../lib/sync';

export const adminRoutes = Router();

const ADMIN_PASSWORD = process.env['ADMIN_PASSWORD'] || 'admin';

// Simple password auth middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  // Check session cookie or query param or header
  const pwd =
    req.query['pw'] as string ||
    req.body?.password ||
    req.headers['x-admin-password'] as string ||
    (req.cookies && req.cookies['admin_pw']);

  // Check if already authenticated via cookie
  const cookieHeader = req.headers.cookie || '';
  const match = cookieHeader.match(/admin_pw=([^;]+)/);
  const cookiePw = match ? decodeURIComponent(match[1]) : null;

  if (pwd === ADMIN_PASSWORD || cookiePw === ADMIN_PASSWORD) {
    // Set cookie for future requests
    if (pwd === ADMIN_PASSWORD && cookiePw !== ADMIN_PASSWORD) {
      res.cookie('admin_pw', ADMIN_PASSWORD, { httpOnly: true, maxAge: 86400000 });
    }
    next();
  } else {
    res.render('admin/login');
  }
}

// Login page
adminRoutes.get('/login', (_req, res) => {
  res.render('admin/login');
});

adminRoutes.post('/login', (req, res) => {
  if (req.body.password === ADMIN_PASSWORD) {
    res.setHeader('Set-Cookie', `admin_pw=${encodeURIComponent(ADMIN_PASSWORD)}; HttpOnly; Path=/; Max-Age=86400`);
    res.redirect('/admin');
  } else {
    res.render('admin/login', { error: 'Wrong password' });
  }
});

// Dashboard
adminRoutes.get('/', requireAuth, async (_req, res) => {
  try {
    const listings = await getAllListings();
    const exitRoutes = await getAllExitRoutes();
    const airlineStatuses = await getAirlineStatuses();
    const lastSync = await getLastSync();
    res.render('admin/dashboard', { listings, exitRoutes, airlineStatuses, lastSync });
  } catch (err) {
    console.error('[admin] Dashboard error:', err);
    res.status(500).send('Error loading dashboard');
  }
});

// Create listing
adminRoutes.post('/listings', requireAuth, async (req, res) => {
  try {
    await createListing({
      title: req.body.title,
      description: req.body.description || '',
      departureDate: req.body.departure_date || null,
      departurePoint: req.body.departure_point || '',
      destination: req.body.destination || '',
      price: req.body.price || '',
      contact: req.body.contact || '',
      spotsRemaining: req.body.spots_remaining ? parseInt(req.body.spots_remaining) : null,
    });
    res.redirect('/admin');
  } catch (err) {
    console.error('[admin] Create listing error:', err);
    res.status(500).send('Failed to create listing');
  }
});

// Update/deactivate listing
adminRoutes.post('/listings/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const data: Record<string, unknown> = {};

    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.departure_date !== undefined) data.departureDate = req.body.departure_date || null;
    if (req.body.departure_point !== undefined) data.departurePoint = req.body.departure_point;
    if (req.body.destination !== undefined) data.destination = req.body.destination;
    if (req.body.price !== undefined) data.price = req.body.price;
    if (req.body.contact !== undefined) data.contact = req.body.contact;
    if (req.body.spots_remaining !== undefined) data.spotsRemaining = req.body.spots_remaining ? parseInt(req.body.spots_remaining) : null;
    if (req.body.active !== undefined) data.active = req.body.active === 'true' || req.body.active === true;

    await updateListing(id, data as any);
    res.redirect('/admin');
  } catch (err) {
    console.error('[admin] Update listing error:', err);
    res.status(500).send('Failed to update listing');
  }
});

// PATCH endpoint for API usage
adminRoutes.patch('/listings/:id', requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updated = await updateListing(id, req.body);
    if (updated) {
      res.json(updated);
    } else {
      res.status(404).json({ error: 'Listing not found' });
    }
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

// Exit routes management
adminRoutes.post('/exit-routes', requireAuth, async (req, res) => {
  try {
    await upsertExitRoute({
      id: req.body.id ? parseInt(req.body.id) : undefined,
      title: req.body.title,
      subtitle: req.body.subtitle || '',
      description: req.body.description || '',
      status: req.body.status || 'unknown',
      icon: req.body.icon || 'route',
      sortOrder: req.body.sort_order ? parseInt(req.body.sort_order) : 0,
      active: req.body.active !== 'false',
    });
    res.redirect('/admin');
  } catch (err) {
    console.error('[admin] Exit route error:', err);
    res.status(500).send('Failed to save exit route');
  }
});

// Manual sync trigger
adminRoutes.post('/sync', requireAuth, async (_req, res) => {
  try {
    const result = await runSync();
    res.redirect('/admin');
  } catch (err) {
    res.status(500).send('Sync failed');
  }
});
