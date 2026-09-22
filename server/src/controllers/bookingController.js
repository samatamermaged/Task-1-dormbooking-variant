import Joi from 'joi';
import { Booking } from '../models/Booking.js';

// Validation Schemas
const createBookingSchema = Joi.object({
  roomNumber: Joi.string().required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().greater(Joi.ref('startDate')).required().messages({
    'date.greater': 'End date must be greater than "startDate"'
  }),
  purpose: Joi.string().optional(),
  bookedBy: Joi.string().hex().length(24).required() // ensures that the string is a valid mongodb objectid
});

const updateBookingSchema = Joi.object({
  roomNumber: Joi.string(),
  startDate: Joi.date(),
  endDate: Joi.date().greater(Joi.ref('startDate')).messages({
    'date.greater': '"endDate" must be strictly after "startDate"'
  }),
  purpose: Joi.string(),
  bookedBy: Joi.string().hex().length(24)
}).min(1);

// Conflict Detection Helper
async function checkConflict(roomNumber, proposedStartDate, proposedEndDate, excludeBookingId = null) {
  const query = {
    roomNumber: roomNumber,
    startDate: { $lt: proposedEndDate },
    endDate: { $gt: proposedStartDate }
  };
  
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  
  return await Booking.findOne(query);
}

// GET /api/bookings
export async function getAllBookings(req, res, next) {
  try {
    const bookings = await Booking.find()
      .sort({ startDate: 1 })
      .populate('bookedBy', 'name email') // Stretch goal: populate user details
      .lean();
    res.json({ bookings });
  } catch (err) { next(err); }
}

// GET /api/bookings/:id
export async function getBooking(req, res, next) {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('bookedBy', 'name email') // Stretch goal: populate user details
      .lean();
      
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) { next(err); }
}

// POST /api/bookings
export async function createBooking(req, res, next) {
  try {
    const { value, error } = createBookingSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });
    
    const conflict = await checkConflict(value.roomNumber, value.startDate, value.endDate);
    if (conflict) {
      return res.status(409).json({ message: 'Room is already booked for these dates.' });
    }
    
    const booking = await Booking.create(value);
    res.status(201).json({ booking });
  } catch (err) { next(err); }
}

// PATCH /api/bookings/:id
export async function updateBooking(req, res, next) {
  try {
    const { value, error } = updateBookingSchema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) return res.status(400).json({ message: error.message });

    const existingBooking = await Booking.findById(req.params.id);
    if (!existingBooking) return res.status(404).json({ message: 'Booking not found' });

    const roomNumber = value.roomNumber || existingBooking.roomNumber;
    const startDate = value.startDate || existingBooking.startDate;
    const endDate = value.endDate || existingBooking.endDate;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: 'Resulting endDate must be strictly after startDate' });
    }

    // We only need to run the database check if they are actually changing the room or dates
    if (value.roomNumber || value.startDate || value.endDate) {
      const conflict = await checkConflict(roomNumber, startDate, endDate, req.params.id);
      if (conflict) return res.status(409).json({ message: 'Room is already booked for these dates' });
    }

    const doc = await Booking.findByIdAndUpdate(
      req.params.id, 
      { $set: value }, 
      { new: true, runValidators: true }
    );
    
    res.json({ booking: doc });
  } catch (err) { next(err); }
}

// DELETE /api/bookings/:id
export async function deleteBooking(req, res, next) {
  try {
    const doc = await Booking.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Booking not found' });
    
    res.json({ message: 'Booking successfully deleted', booking: doc });
  } catch (err) { next(err); }
}