const express = require('express');
const { getDB } = require('../config/db');
const { getDisplaySummary } = require('../services/ticketService');
const { getEffectiveDay } = require('../services/sequenceService');

function displayRouter() {
  const router = express.Router();

  // Man hinh cho chung + man hinh benh nhan tung quay deu co the goi API nay
  // (hoac lang nghe socket 'queue:summary' de cap nhat realtime, khong can goi lai API).
  router.get('/summary', (req, res) => {
    const db = getDB();
    const summary = getDisplaySummary(db, getEffectiveDay(db));
    res.json(summary);
  });

  return router;
}

module.exports = displayRouter;
