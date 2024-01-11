const mongoose = require('mongoose');

const loginHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  loginTime: {
    type: Date,
    default: Date.now,
  },
  logoutTime: {
    type: Date,
  }
  // You can add additional fields if needed, such as IP address, user agent, etc.
});

const LoginHistory = mongoose.model('LoginHistory', loginHistorySchema);

module.exports = LoginHistory;