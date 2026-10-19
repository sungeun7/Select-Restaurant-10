const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');

const { getPool } = require('./db');
const { createSessionStore } = require('./sessionStore');
const { requireAuth } = require('./middleware/requireAuth');
const { uploadReviewPhotoBase64 } = require('./storage');
const { CATEGORIES, SEED_RESTAURANTS, SEED_WEEKLY_USERS, toRating10 } = require('./hallSeeds');

const POINTS_REVIEW_ONLY = 50;
const POINTS_REVIEW_WITH_PHOTO = 100;
const POINTS_AD_WATCH = 10;
const POINTS_ATTENDANCE = 50;

const app = express();

app.set('trust proxy', 1);

// ===== CORS (쿠키 세션 포함) =====
// Cloud Run backend과 프론트 오리진이 다를 수 있으므로, credentials 요청이 동작하도록 허용합니다.
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');

  if (req.method === 'OPTIONS') return res.status(204).end();
  return next();
});

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

async function ensureMasterUser(pool) {
  const masterUsername = process.env.MASTER_USERNAME || 'master';
  const masterPassword = process.env.MASTER_PASSWORD || '1111';

  const [rows] = await pool.query('SELECT username, is_master FROM users WHERE username = ? LIMIT 1', [
    masterUsername,
  ]);

  const exists = rows && rows.length > 0;
  if (exists) {
    if (rows[0].is_master !== 1) {
      await pool.query('UPDATE users SET is_master = 1 WHERE username = ?', [masterUsername]);
    }
    return;
  }

  const passwordHash = await bcrypt.hash(masterPassword, 10);
  await pool.query('INSERT INTO users (username, password_hash, is_master) VALUES (?, ?, 1)', [
    masterUsername,
    passwordHash,
  ]);
}

function safeTrim(s) {
  return (s || '').toString().trim();
}

async function getHallSeedEnabled(pool) {
  const [rows] = await pool.query('SELECT enabled FROM hall_seed_state WHERE id = 1 LIMIT 1');
  if (!rows || rows.length === 0) return true;
  return rows[0].enabled === 1;
}

async function getAds(pool) {
  const [rows] = await pool.query('SELECT ad_type, url FROM ads WHERE id = 1 LIMIT 1');
  if (!rows || rows.length === 0) return null;
  return { type: rows[0].ad_type, url: rows[0].url };
}

async function getUserPointsTotal(pool, username) {
  const [rows] = await pool.query('SELECT total_points FROM user_points_total WHERE username = ? LIMIT 1', [
    username,
  ]);
  if (!rows || rows.length === 0) return 0;
  return parseInt(rows[0].total_points || 0, 10);
}

async function getUserPointHistory(pool, username) {
  // Return up to 500 events to match the localStorage behavior.
  const [rows] = await pool.query(
    'SELECT at, points, reason FROM point_history WHERE username = ? ORDER BY at DESC LIMIT 500',
    [username],
  );
  // Front code sums by filtering by date; order is not critical. Still, return chronological for readability.
  return (rows || [])
    .slice()
    .reverse()
    .map((r) => ({
      at: r.at instanceof Date ? r.at.toISOString() : new Date(r.at).toISOString(),
      points: parseInt(r.points || 0, 10),
      reason: r.reason || '',
    }));
}

async function getUserReviews(pool, username) {
  const [rows] = await pool.query(
    'SELECT id, name, location, category, rating_dec, comment, detail, visit_date, photo_url, created_at FROM reviews WHERE owner_username = ? ORDER BY id DESC',
    [username],
  );

  return (rows || []).map((r) => {
    let visitDate = '';
    if (r.visit_date) {
      if (typeof r.visit_date === 'string') visitDate = r.visit_date;
      else if (r.visit_date instanceof Date) visitDate = r.visit_date.toISOString().slice(0, 10);
      else visitDate = String(r.visit_date);
    }

    return {
    id: r.id,
    name: r.name,
    location: r.location || '',
    category: r.category || '',
    rating: parseFloat(r.rating_dec || 0),
    comment: r.comment || '',
    detail: r.detail || '',
    visitDate,
    photo: r.photo_url || null,
    createdAt: r.created_at instanceof Date ? r.created_at.toISOString() : new Date(r.created_at).toISOString(),
    };
  });
}

async function getAttendance(pool, username) {
  const [rows] = await pool.query(
    'SELECT last_attendance_date FROM attendance WHERE username = ? LIMIT 1',
    [username],
  );
  if (!rows || rows.length === 0) return null;
  const v = rows[0].last_attendance_date;
  if (!v) return null;
  return v.toISOString ? v.toISOString().slice(0, 10) : v; // mysql driver may return date string
}

async function addPoints(pool, username, points, reason) {
  // Cache total points + append to point_history.
  // Ensure the user_points_total row exists.
  await pool.query('INSERT INTO user_points_total (username, total_points) VALUES (?, 0) ON DUPLICATE KEY UPDATE username = username', [
    username,
  ]);
  await pool.query('UPDATE user_points_total SET total_points = total_points + ? WHERE username = ?', [
    points,
    username,
  ]);
  await pool.query('INSERT INTO point_history (username, at, points, reason) VALUES (?, NOW(), ?, ?)', [
    username,
    points,
    reason,
  ]);
  const [rows] = await pool.query('SELECT total_points FROM user_points_total WHERE username = ? LIMIT 1', [
    username,
  ]);
  return rows && rows.length ? parseInt(rows[0].total_points || 0, 10) : 0;
}

async function getWeeklyPoints(pool, username) {
  const [rows] = await pool.query(
    'SELECT COALESCE(SUM(points), 0) AS weekly_points FROM point_history WHERE username = ? AND at >= (NOW() - INTERVAL 7 DAY)',
    [username],
  );
  if (!rows || rows.length === 0) return 0;
  return parseInt(rows[0].weekly_points || 0, 10);
}

function normalizeCategory(category) {
  const c = safeTrim(category);
  if (!c) return '';
  if (CATEGORIES.includes(c)) return c;
  return '';
}

async function isMasterUser(pool, username) {
  const [rows] = await pool.query('SELECT is_master FROM users WHERE username = ? LIMIT 1', [username]);
  if (!rows || rows.length === 0) return false;
  return rows[0].is_master === 1;
}

async function start() {
  const pool = await getPool();
  await ensureMasterUser(pool);
  const sessionStore = await createSessionStore();

  if (!process.env.SESSION_SECRET) {
    throw new Error('Missing env: SESSION_SECRET');
  }

  app.use(
    session({
      name: 'sr10_sid',
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        // If front/back are on different origins, SameSite=Lax may block cookie on cross-site requests.
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7
      },
    }),
  );

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  // ===== Auth =====
  app.post('/api/auth/signup', async (req, res) => {
    try {
      const username = safeTrim(req.body.username);
      const password = (req.body.password || '').toString();

      if (!username || username.length < 2) return res.status(400).json({ error: 'INVALID_USERNAME' });
      if (!password || password.length < 4) return res.status(400).json({ error: 'INVALID_PASSWORD' });

      const [existing] = await pool.query('SELECT username FROM users WHERE username = ? LIMIT 1', [username]);
      if (existing && existing.length > 0) return res.status(409).json({ error: 'USERNAME_EXISTS' });

      const passwordHash = await bcrypt.hash(password, 10);
      await pool.query('INSERT INTO users (username, password_hash, is_master) VALUES (?, ?, 0)', [
        username,
        passwordHash,
      ]);

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'SIGNUP_FAILED' });
    }
  });

  app.post('/api/auth/login', async (req, res) => {
    try {
      const username = safeTrim(req.body.username);
      const password = (req.body.password || '').toString();

      const [rows] = await pool.query(
        'SELECT username, password_hash, is_master FROM users WHERE username = ? LIMIT 1',
        [username],
      );

      if (!rows || rows.length === 0) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

      const userRow = rows[0];
      const ok = await bcrypt.compare(password, userRow.password_hash);
      if (!ok) return res.status(401).json({ error: 'INVALID_CREDENTIALS' });

      req.session.user = { username: userRow.username, isMaster: userRow.is_master === 1 };
      return res.json({ ok: true, user: req.session.user });
    } catch (e) {
      return res.status(500).json({ error: 'LOGIN_FAILED' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    if (!req.session) return res.json({ ok: true });
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get('/api/auth/me', (req, res) => {
    res.json(req.session && req.session.user ? req.session.user : null);
  });

  // ===== My Page (username/password change) =====
  app.put('/api/users/me/username', requireAuth, async (req, res) => {
    try {
      const currentUsername = req.session.user.username;
      const newUsername = safeTrim(req.body.username);

      if (!newUsername || newUsername.length < 2) return res.status(400).json({ error: 'INVALID_USERNAME' });
      if (newUsername === currentUsername) return res.status(400).json({ error: 'SAME_USERNAME' });

      const [meRows] = await pool.query('SELECT password_hash, is_master FROM users WHERE username = ? LIMIT 1', [
        currentUsername,
      ]);
      if (!meRows || meRows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

      const [exists] = await pool.query('SELECT username FROM users WHERE username = ? LIMIT 1', [newUsername]);
      if (exists && exists.length) return res.status(409).json({ error: 'USERNAME_EXISTS' });

      const passwordHash = meRows[0].password_hash;
      const isMaster = meRows[0].is_master === 1;

      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await conn.query('INSERT INTO users (username, password_hash, is_master) VALUES (?, ?, ?)', [
          newUsername,
          passwordHash,
          isMaster ? 1 : 0,
        ]);

        await conn.query('UPDATE reviews SET owner_username = ? WHERE owner_username = ?', [newUsername, currentUsername]);
        await conn.query('UPDATE point_history SET username = ? WHERE username = ?', [newUsername, currentUsername]);
        await conn.query('UPDATE user_points_total SET username = ? WHERE username = ?', [newUsername, currentUsername]);
        await conn.query('UPDATE attendance SET username = ? WHERE username = ?', [newUsername, currentUsername]);

        await conn.query('DELETE FROM users WHERE username = ?', [currentUsername]);
        await conn.commit();
      } catch (e) {
        await conn.rollback();
        throw e;
      } finally {
        conn.release();
      }

      req.session.user = { username: newUsername, isMaster };
      return res.json({ ok: true, user: req.session.user });
    } catch (e) {
      return res.status(500).json({ error: 'USERNAME_UPDATE_FAILED' });
    }
  });

  app.put('/api/users/me/password', requireAuth, async (req, res) => {
    try {
      const currentUsername = req.session.user.username;
      const currentPassword = (req.body.currentPassword || '').toString();
      const newPassword = (req.body.newPassword || '').toString();

      if (!currentPassword) return res.status(400).json({ error: 'MISSING_CURRENT_PASSWORD' });
      if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'INVALID_NEW_PASSWORD' });

      const [rows] = await pool.query('SELECT password_hash FROM users WHERE username = ? LIMIT 1', [
        currentUsername,
      ]);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });

      const ok = await bcrypt.compare(currentPassword, rows[0].password_hash);
      if (!ok) return res.status(400).json({ error: 'PASSWORD_MISMATCH' });

      const newHash = await bcrypt.hash(newPassword, 10);
      await pool.query('UPDATE users SET password_hash = ? WHERE username = ?', [newHash, currentUsername]);

      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'PASSWORD_UPDATE_FAILED' });
    }
  });

  // ===== Init (basic app state) =====
  app.get('/api/init', async (req, res) => {
    try {
      const currentUser = req.session && req.session.user ? req.session.user : null;
      const hallSeedEnabled = await getHallSeedEnabled(pool);
      const ads = await getAds(pool);

      if (!currentUser) {
        return res.json({
          currentUser: null,
          pointsTotal: 0,
          pointHistory: [],
          reviews: [],
          lastAttendanceDate: null,
          ads,
          hallSeedEnabled,
        });
      }

      const [pointsTotal, pointHistory, reviews, lastAttendanceDate] = await Promise.all([
        getUserPointsTotal(pool, currentUser.username),
        getUserPointHistory(pool, currentUser.username),
        getUserReviews(pool, currentUser.username),
        getAttendance(pool, currentUser.username),
      ]);

      return res.json({
        currentUser,
        pointsTotal,
        pointHistory,
        reviews,
        lastAttendanceDate,
        ads,
        hallSeedEnabled,
      });
    } catch (e) {
      return res.status(500).json({ error: 'INIT_FAILED' });
    }
  });

  // ===== Reviews CRUD =====
  app.get('/api/reviews', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const reviews = await getUserReviews(pool, username);
      return res.json({ reviews });
    } catch (e) {
      return res.status(500).json({ error: 'REVIEWS_LIST_FAILED' });
    }
  });

  app.post('/api/reviews', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;

      const name = safeTrim(req.body.name);
      if (!name) return res.status(400).json({ error: 'MISSING_NAME' });

      const location = safeTrim(req.body.location);
      const category = normalizeCategory(req.body.category);
      const rawRating = req.body.rating;
      const rating = toRating10(rawRating);

      const comment = safeTrim(req.body.comment);
      const detail = safeTrim(req.body.detail);

      const visitDateIn = safeTrim(req.body.visitDate);
      const visit_date = visitDateIn ? visitDateIn : null; // DATE or NULL

      const todayStr = new Date().toISOString().slice(0, 10);
      const referenceDate = visit_date || todayStr;

      // One review per restaurant per 7 days (per user).
      const [existing] = await pool.query(
        `SELECT id FROM reviews
         WHERE owner_username = ?
           AND LOWER(name) = LOWER(?)
           AND ABS(DATEDIFF(COALESCE(visit_date, DATE(created_at)), ?)) < 7
         LIMIT 1`,
        [username, name, referenceDate],
      );

      if (existing && existing.length > 0) {
        return res.status(409).json({ error: 'ONE_REVIEW_PER_WEEK' });
      }

      const hasPhotoKey = Object.prototype.hasOwnProperty.call(req.body, 'photoBase64');
      const photoBase64 = hasPhotoKey ? req.body.photoBase64 : null;
      const hasPhoto = typeof photoBase64 === 'string' && photoBase64.trim().length > 0;

      let photoUrl = null;
      let points = POINTS_REVIEW_ONLY;
      let reason = 'review';

      if (hasPhoto) {
        const out = await uploadReviewPhotoBase64(photoBase64);
        if (!out || !out.photoUrl) return res.status(400).json({ error: 'INVALID_PHOTO' });
        photoUrl = out.photoUrl;
        points = POINTS_REVIEW_WITH_PHOTO;
        reason = 'review_photo';
      }

      const [result] = await pool.query(
        `INSERT INTO reviews
         (owner_username, name, location, category, rating_dec, comment, detail, visit_date, photo_url)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [username, name, location || null, category || null, rating, comment || null, detail || null, visit_date, photoUrl],
      );

      const pointsTotal = await addPoints(pool, username, points, reason);

      const reviewId = result && result.insertId ? result.insertId : null;
      return res.json({ ok: true, reviewId, pointsTotal });
    } catch (e) {
      return res.status(500).json({ error: 'REVIEW_CREATE_FAILED' });
    }
  });

  app.put('/api/reviews/:id', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: 'INVALID_ID' });

      const [rows] = await pool.query('SELECT id, owner_username FROM reviews WHERE id = ? LIMIT 1', [id]);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'NOT_FOUND' });
      if (rows[0].owner_username !== username) return res.status(403).json({ error: 'FORBIDDEN' });

      const name = safeTrim(req.body.name);
      const location = safeTrim(req.body.location);
      const category = normalizeCategory(req.body.category);
      const rating = toRating10(req.body.rating);
      const comment = safeTrim(req.body.comment);
      const detail = safeTrim(req.body.detail);
      const visitDateIn = safeTrim(req.body.visitDate);
      const visit_date = visitDateIn ? visitDateIn : null;

      let photoUrlUpdate = undefined; // undefined => no change
      if (Object.prototype.hasOwnProperty.call(req.body, 'photoBase64')) {
        const photoBase64 = req.body.photoBase64;
        if (typeof photoBase64 === 'string' && photoBase64.trim().length > 0) {
          const out = await uploadReviewPhotoBase64(photoBase64);
          photoUrlUpdate = out ? out.photoUrl : null;
        } else {
          photoUrlUpdate = null; // explicit removal
        }
      }

      // Build update query (photo_url is optional).
      if (photoUrlUpdate !== undefined) {
        await pool.query(
          `UPDATE reviews
           SET name = ?, location = ?, category = ?, rating_dec = ?, comment = ?, detail = ?, visit_date = ?, photo_url = ?
           WHERE id = ?`,
          [name, location || null, category || null, rating, comment || null, detail || null, visit_date, photoUrlUpdate, id],
        );
      } else {
        await pool.query(
          `UPDATE reviews
           SET name = ?, location = ?, category = ?, rating_dec = ?, comment = ?, detail = ?, visit_date = ?
           WHERE id = ?`,
          [name, location || null, category || null, rating, comment || null, detail || null, visit_date, id],
        );
      }

      const reviews = await getUserReviews(pool, username);
      const updated = reviews.find((r) => r.id === id) || null;
      return res.json({ ok: true, review: updated });
    } catch (e) {
      return res.status(500).json({ error: 'REVIEW_UPDATE_FAILED' });
    }
  });

  app.delete('/api/reviews/:id', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const id = parseInt(req.params.id, 10);
      if (!id) return res.status(400).json({ error: 'INVALID_ID' });

      const [result] = await pool.query('DELETE FROM reviews WHERE id = ? AND owner_username = ?', [id, username]);
      // mysql2 returns OKPacket as [result]
      if (!result || result.affectedRows === 0) return res.status(404).json({ error: 'NOT_FOUND' });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'REVIEW_DELETE_FAILED' });
    }
  });

  // ===== Attendance =====
  app.post('/api/attendance/claim', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const todayStr = new Date().toISOString().slice(0, 10);

      const [rows] = await pool.query(
        'SELECT last_attendance_date FROM attendance WHERE username = ? LIMIT 1',
        [username],
      );
      const last = rows && rows.length ? rows[0].last_attendance_date : null;
      const lastStr = last ? (last.toISOString ? last.toISOString().slice(0, 10) : last) : null;

      if (lastStr === todayStr) {
        const pointsTotal = await getUserPointsTotal(pool, username);
        return res.json({ ok: true, alreadyClaimed: true, pointsTotal });
      }

      await pool.query(
        'INSERT INTO attendance (username, last_attendance_date) VALUES (?, ?) ON DUPLICATE KEY UPDATE last_attendance_date = VALUES(last_attendance_date)',
        [username, todayStr],
      );

      const pointsTotal = await addPoints(pool, username, POINTS_ATTENDANCE, 'attendance');
      return res.json({ ok: true, pointsTotal });
    } catch (e) {
      return res.status(500).json({ error: 'ATTENDANCE_CLAIM_FAILED' });
    }
  });

  // ===== Points reward (used by ad watch, etc.) =====
  app.post('/api/points/reward', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const reason = safeTrim(req.body.reason);
      const amount = parseInt(req.body.amount, 10);

      if (!reason) return res.status(400).json({ error: 'MISSING_REASON' });
      if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'INVALID_AMOUNT' });

      // Demo-level validation to match app behavior.
      if (reason === 'ad' && amount !== POINTS_AD_WATCH) return res.status(400).json({ error: 'INVALID_AD_AMOUNT' });
      if (reason === 'attendance' && amount !== POINTS_ATTENDANCE) return res.status(400).json({ error: 'INVALID_ATTEND_AMOUNT' });

      const pointsTotal = await addPoints(pool, username, amount, reason);
      return res.json({ ok: true, pointsTotal });
    } catch (e) {
      return res.status(500).json({ error: 'POINT_REWARD_FAILED' });
    }
  });

  // ===== Ads =====
  app.get('/api/ads', async (req, res) => {
    try {
      const ads = await getAds(pool);
      return res.json({ ads });
    } catch (e) {
      return res.status(500).json({ error: 'ADS_LIST_FAILED' });
    }
  });

  app.post('/api/ads', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const masterOk = await isMasterUser(pool, username);
      if (!masterOk) return res.status(403).json({ error: 'FORBIDDEN' });

      const type = safeTrim(req.body.type);
      const url = safeTrim(req.body.url);
      if (!type || (type !== 'image' && type !== 'iframe')) return res.status(400).json({ error: 'INVALID_TYPE' });
      if (!url) return res.status(400).json({ error: 'MISSING_URL' });

      await pool.query(
        'INSERT INTO ads (id, ad_type, url) VALUES (1, ?, ?) ON DUPLICATE KEY UPDATE ad_type = VALUES(ad_type), url = VALUES(url)',
        [type, url],
      );
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'ADS_SAVE_FAILED' });
    }
  });

  app.delete('/api/ads', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const masterOk = await isMasterUser(pool, username);
      if (!masterOk) return res.status(403).json({ error: 'FORBIDDEN' });

      await pool.query('DELETE FROM ads WHERE id = 1');
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: 'ADS_DELETE_FAILED' });
    }
  });

  // ===== Hall of Fame =====
  app.post('/api/hall/seed/toggle', requireAuth, async (req, res) => {
    try {
      const username = req.session.user.username;
      const masterOk = await isMasterUser(pool, username);
      if (!masterOk) return res.status(403).json({ error: 'FORBIDDEN' });

      const [rows] = await pool.query('SELECT enabled FROM hall_seed_state WHERE id = 1 LIMIT 1');
      const current = rows && rows.length ? (rows[0].enabled === 1) : true;
      const next = current ? 0 : 1;
      await pool.query('UPDATE hall_seed_state SET enabled = ? WHERE id = 1', [next]);

      return res.json({ ok: true, hallSeedEnabled: next === 1 });
    } catch (e) {
      return res.status(500).json({ error: 'HALL_SEED_TOGGLE_FAILED' });
    }
  });

  app.get('/api/hall/people', async (req, res) => {
    try {
      const hallSeedEnabled = await getHallSeedEnabled(pool);
      const currentUser = req.session && req.session.user ? req.session.user : null;

      const list = [];

      if (currentUser) {
        const weeklyPoints = await getWeeklyPoints(pool, currentUser.username);
        const totalPoints = await getUserPointsTotal(pool, currentUser.username);
        list.push({
          name: currentUser.username,
          weeklyPoints,
          totalPoints,
          isMe: true,
        });
      } else {
        list.push({
          name: '나',
          weeklyPoints: 0,
          totalPoints: 0,
          isMe: true,
        });
      }

      if (hallSeedEnabled) {
        SEED_WEEKLY_USERS.forEach((u) => {
          list.push({ ...u, isMe: false });
        });
      }

      list.sort((a, b) => (b.weeklyPoints || 0) - (a.weeklyPoints || 0));
      return res.json({ reviewers: list });
    } catch (e) {
      return res.status(500).json({ error: 'HALL_PEOPLE_FAILED' });
    }
  });

  app.get('/api/hall/restaurants', async (req, res) => {
    try {
      const hallSeedEnabled = await getHallSeedEnabled(pool);
      const category = normalizeCategory(req.query.category);
      const currentUser = req.session && req.session.user ? req.session.user : null;

      const map = new Map(); // name -> { rating, category }

      if (currentUser) {
        const [rows] = await pool.query(
          'SELECT name, rating_dec, category FROM reviews WHERE owner_username = ?',
          [currentUser.username],
        );
        (rows || []).forEach((r) => {
          const n = safeTrim(r.name);
          if (!n) return;
          const rating = toRating10(r.rating_dec);
          const cur = map.get(n);
          if (!cur || (cur.rating < rating)) {
            map.set(n, { rating, category: r.category || '' });
          }
        });
      }

      if (hallSeedEnabled) {
        SEED_RESTAURANTS.forEach((s) => {
          const n = safeTrim(s.name);
          if (!n) return;
          const rating = toRating10(s.rating);
          const cur = map.get(n);
          if (!cur || cur.rating < rating) map.set(n, { rating, category: s.category || '' });
        });
      }

      let list = Array.from(map.entries()).map(([name, o]) => ({ name, rating: o.rating, category: o.category }));
      if (category) {
        list = list.filter((r) => (r.category || '').trim() === category);
      }

      list.sort((a, b) => b.rating - a.rating);
      list = list.slice(0, 15);
      return res.json({ restaurants: list });
    } catch (e) {
      return res.status(500).json({ error: 'HALL_RESTAURANTS_FAILED' });
    }
  });

  // ===== Photo upload helper =====
  // This endpoint is mainly to support review photo upload:
  // clients can send base64 data URL and receive a public URL.
  app.post('/api/upload/photo', requireAuth, async (req, res) => {
    try {
      const photoBase64 = req.body.photoBase64;
      if (!photoBase64) return res.status(400).json({ error: 'MISSING_PHOTO' });
      const out = await uploadReviewPhotoBase64(photoBase64);
      if (!out) return res.status(400).json({ error: 'INVALID_PHOTO' });
      return res.json(out);
    } catch (e) {
      return res.status(500).json({ error: 'UPLOAD_FAILED' });
    }
  });

  // ===== Placeholder: other endpoints will be implemented later =====
  app.get('/api/not-implemented', requireAuth, (req, res) => {
    res.status(501).json({ error: 'NOT_IMPLEMENTED' });
  });

  const port = process.env.PORT || 8080;
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`SR10 backend listening on ${port}`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start backend:', err);
  process.exit(1);
});

