import mongoose from 'mongoose';

// TODO: define the Booking schema per README.md section 1.

const bookingSchema = new mongoose.Schema(
  {
   roomNumber:{ type: String, required:true},
   startDate:{ type:Date, required:true},
   endDate:{ type:Date, required:true},
   purpose :{ type:String},
   bookedBy:{ type:mongoose.Schema.Types.ObjectId, ref:'User'}
  },
  { timestamps: true }
);

export const Booking = mongoose.model('Booking', bookingSchema);
