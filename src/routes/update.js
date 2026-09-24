const express = require('express');
const { isValidSession } = require('../services/authService');
const { checkNow, installUpdate, publicStatus, loadConfig } = require('../services/updateService');

/**
 * MUC 117 - API cap nhat phan mem server (chi nhan vien da dang nhap):
 *   GET  /api/update/status  -> trang thai (ket qua lan kiem tra ngam gan nhat)
 *   POST /api/update/check   -> kiem tra ngay
 *   POST /api/update/install -> tai + chay bo cai im lang (server se tu dung va khoi dong lai)
 */
function requireStaff(req, res, next) {
  if (!isValidSession(req.cookies?.staff_token)) {
    return res.status(401).json({ error: 'Chưa đăng nhập nhân viên' });
  }
  next();
}

function updateRouter() {
  const router = express.Router();
  router.use(requireStaff);

  router.get('/status', (req, res) => {
    loadConfig();
    res.json(publicStatus());
  });

  router.post('/check', async (req, res) => {
    res.json(await checkNow());
  });

  router.post('/install', async (req, res) => {
    try {
      res.json(await installUpdate());
    } catch (err) {
      res.status(400).json({ ...publicStatus(), error: err.message });
    }
  });

  return router;
}

module.exports = updateRouter;
