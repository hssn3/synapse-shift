const express = require('express');
const router = express.Router();
router.use(require('./shift-wards.routes'));
router.use(require('./shift-staff.routes'));
router.use(require('./shift-schedule.routes'));
router.use(require('./shift-codes.routes'));
module.exports = router;
