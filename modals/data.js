const mongoose = require('mongoose');

// Define a schema model for executives
const dataSechema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  company: {
    type: String,
    required: true,
  },
  mobile: {
    type: String,
    required: true,
  },
  dataFor: {
type:String
  },
  status: {
    type: String, // You can use a different type if 'status' should be something other than a string
    default: 'pending', // Set a default status, you can change this as per your requirements
  }
});

// Create a model based on the schema
const DataExecutive = mongoose.model('ExecutiveData', dataSechema);

module.exports = DataExecutive;