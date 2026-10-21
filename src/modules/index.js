/**
 * ماژول‌های دامنه — این نسخه فقط ماژول «پرسنل و برنامه‌ی ماهانه‌ی شیفت» را بالا می‌آورد.
 */
const express = require('express');
const router = express.Router();

router.use(require('./clinical'));

module.exports = router;
