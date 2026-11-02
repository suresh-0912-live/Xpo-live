import asyncHandler from '../utils/asyncHandler.js'
import {
  createNotification as createNotificationRecord,
  deleteNotification as deleteNotificationRecord,
  getDeliveryStatus,
  getNotification as getNotificationRecord,
  listDeliveryHistory,
  listNotifications as listNotificationRecords,
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  sendNotification as sendNotificationRecord,
  updateNotification as updateNotificationRecord,
  updateNotificationStatus,
} from '../services/notification.service.js'

export const listNotifications = asyncHandler(async (req, res) => {
  const { page, pageSize, status, type, target, query, sort } = req.query
  const result = await listNotificationRecords({
    page: Number(page) || 1,
    pageSize: Number(pageSize) || 25,
    status,
    type,
    target,
    query,
    sort,
  })
  res.json(result)
})

export const getNotification = asyncHandler(async (req, res) => {
  const notification = await getNotificationRecord(req.params.id)
  res.json({ notification })
})

export const createNotification = asyncHandler(async (req, res) => {
  const notification = await createNotificationRecord(req.body, req.auth.email, req.ip)
  res.status(201).json({ notification })
})

export const updateNotification = asyncHandler(async (req, res) => {
  const notification = await updateNotificationRecord(req.params.id, req.body, req.auth.email, req.ip)
  res.json({ notification })
})

export const updateNotificationStatusRoute = asyncHandler(async (req, res) => {
  const notification = await updateNotificationStatus(req.params.id, req.body.status, req.auth.email, req.ip)
  res.json({ notification })
})

export const deleteNotification = asyncHandler(async (req, res) => {
  const result = await deleteNotificationRecord(req.params.id, req.auth.email, req.ip)
  res.json(result)
})

export const sendNotificationRoute = asyncHandler(async (req, res) => {
  const result = await sendNotificationRecord(req.params.id, req.auth.email, { ip: req.ip })
  res.json(result)
})

export const getDeliveryStatusRoute = asyncHandler(async (req, res) => {
  res.json(await getDeliveryStatus(req.params.id))
})

export const listDeliveriesRoute = asyncHandler(async (req, res) => {
  const deliveries = await listDeliveryHistory({
    notificationId: req.params.id,
    page: req.query.page,
    pageSize: req.query.pageSize,
  })
  res.json({ deliveries })
})

export const listAllDeliveriesRoute = asyncHandler(async (req, res) => {
  const deliveries = await listDeliveryHistory({ page: req.query.page, pageSize: req.query.pageSize })
  res.json({ deliveries })
})

export const listMyNotifications = asyncHandler(async (req, res) => {
  const result = await listUserNotifications(req.auth.sub, {
    page: req.query.page,
    pageSize: req.query.pageSize,
    unreadOnly: req.query.unreadOnly === 'true',
  })
  res.json(result)
})

export const markMyNotificationRead = asyncHandler(async (req, res) => {
  res.json(await markNotificationRead(req.params.id, req.auth.sub))
})

export const markAllMyNotificationsRead = asyncHandler(async (req, res) => {
  res.json(await markAllNotificationsRead(req.auth.sub))
})
