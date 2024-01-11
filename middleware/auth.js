require('dotenv').config
const jwt = require('jsonwebtoken');
const user = require('../modals/executive'); // Import the User model
exports.protect = async (req, res, next) => {
    try {
      // Extract the token from various sources (cookies, body, headers)
      const token =
        req.cookies.token || req.body.token || (req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : '');
  
      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Please Login to Access this',
        });
      }
  
      try {
        // Verify the token
        const decoded = await jwt.verify(token, "uyuiyWJDBHJSGHJBSHJKDGSJKBCSKFDDSYUKDGHK");
        req.user = decoded; // Attach the decoded user information to the request object
        next(); // Continue to the next middleware
      } catch (error) {
        return res.status(401).json({
          success: false,
          message: 'Invalid token',
        });
      }
    } catch (error) {
      // Handle any other errors that might occur within the middleware
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Internal Server Error',
      });
    }
  };
  
