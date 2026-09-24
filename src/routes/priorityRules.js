const express = require('express');
const { getDisplayRules } = require('../config/priorityRules');

/**
 * Endpoint cong khai (khong can dang nhap) tra ve danh sach {code, label, color} cua tung
 * doi tuong uu tien - man hinh quay va man hinh benh nhan cung goi API nay de to mau so va
 * hien chu thich (legend), dam bao mau sac luon dong bo, chi sua 1 noi duy nhat
 * (src/config/priorityRules.js) la cap nhat het moi noi.
 */
function priorityRulesRouter() {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.json(getDisplayRules());
  });
  return router;
}

module.exports = priorityRulesRouter;
