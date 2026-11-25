import { Router } from 'express';
import authorize from '../middleware/authorize.mts';
import { createOrder } from '../services/order.service.mts';
const router = Router();
router.post('/', authorize, async (req, res, next) => {
  try { res.status(201).json(await createOrder(res.locals.user?.id, req.body)); }
  catch (error) { next(error); }
});
export default router;
