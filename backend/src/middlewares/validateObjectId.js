import mongoose from 'mongoose';

/**
 * Param handler for router.param(): rejects malformed MongoDB ids with 400
 * instead of letting Mongoose throw a CastError (which became a 500).
 *
 * Usage: router.param('id', validateObjectId);
 */
const validateObjectId = (req, res, next, value, name) => {
  if (!mongoose.Types.ObjectId.isValid(value) || String(new mongoose.Types.ObjectId(value)) !== value) {
    return res.status(400).json({
      success: false,
      error: `Giá trị ${name} không hợp lệ`
    });
  }
  next();
};

export default validateObjectId;
