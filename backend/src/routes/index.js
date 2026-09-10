'use strict';

const { Router } = require('express');
const { authenticate } = require('../middleware/auth');

const authRoutes = require('./authRoutes');
const visitorRoutes = require('./visitorRoutes');
const visitorRequestRoutes = require('./visitorRequestRoutes');
const checkinRoutes = require('./checkinRoutes');
const meetingRoutes = require('./meetingRoutes');
const userRoutes = require('./userRoutes');
const masterDataRoutes = require('./masterDataRoutes');
const restrictionRoutes = require('./restrictionRoutes');
const reportRoutes = require('./reportRoutes');
const auditRoutes = require('./auditRoutes');
const notificationRoutes = require('./notificationRoutes');
const uploadRoutes = require('./uploadRoutes');

const router = Router();

router.use('/auth', authRoutes);

// Every route below requires a valid session.
router.use('/visitors', authenticate, visitorRoutes);
router.use('/visitor-requests', authenticate, checkinRoutes);
router.use('/visitor-requests', authenticate, visitorRequestRoutes);
router.use('/meetings', authenticate, meetingRoutes);
router.use('/users', authenticate, userRoutes);
router.use('/master-data', authenticate, masterDataRoutes);
router.use('/restricted-entries', authenticate, restrictionRoutes);
router.use('/reports', authenticate, reportRoutes);
router.use('/audit-logs', authenticate, auditRoutes);
router.use('/notifications', authenticate, notificationRoutes);
router.use('/uploads', authenticate, uploadRoutes);

module.exports = router;
