const sendMail = require("../utility/sendMail");
const sendToken = require("../utility/jwt");
const user = require("../modals/executive");
const bcrypt = require("bcrypt");
const moment = require('moment-timezone'); // Import the moment-timezone library
const timezone = 'Asia/Kolkata';
const Clients = require("../modals/clientData");
const jwt = require("jsonwebtoken");
const DataExecutive = require('../modals/data')
const {
  catchAsyncErrors,
  deleteUnactivatedUsers,
} = require("../utility/catchAsync");
const Attendance = require("../modals/attendence");
const User = require("../modals/executive");
const LoginHistory = require("../modals/login")

exports.RegisterUser = catchAsyncErrors(async (req, res) => {
  const { username, email, password, confirmPassword, } = req.body;

  const existingUser = await User.findOne({ email });

  try {
    if (existingUser) {
      throw new ErrorHandler("User already exists with this Email Id", 400);
    } else if (!username || !email || !password || !confirmPassword) {
      throw new ErrorHandler("Please Fill All Fields", 422);
    }

    if (password !== confirmPassword) {
      throw new ErrorHandler("Confirm Password Not Match", 422);
    }

    // Generate a random 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000);

    // Hash the OTP before saving it
    const otpHash = await bcrypt.hash(otp.toString(), 10);

    const newUser = new User({
      username,
      email,
      password,
      isActivated: false,
      otp: otpHash,
    });

    await newUser.save();

    // Send the OTP via email
    await sendMail({
      email: newUser.email,
      subject: "OTP for Account Activation",
      message: `Welcome to DGMT! Your OTP for account activation is: ${ otp }.Please use this code to complete your registration.Thank you for Joining DGMT.`,
    });
res.status(201).json({
  message:
    "User registered successfully. An OTP has been sent to your email for activation.",
  newUser,
});
console.log(newUser);
  } catch (error) {
  console.error("Error:", error);
  res.status(500).json({ error: "An error occurred" });
}
});

setInterval(deleteUnactivatedUsers, 20 * 60 * 1000);

// login For User
exports.login = catchAsyncErrors(async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please Enter Email And Password",
      });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User With this Email Not Existed",
      });
    }

    if (!user.isActivated) {
      return res.status(403).json({
        success: false,
        message: "User Not Activated",
      });
    }

    // Use bcrypt to compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: "Password Mismatch",
      });
    }

    const payload = {
      email: user.email,
      id: user._id,
      role: user.role,
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "10h",
    });

    // Get the current date in IST (without time)
    const currentDateIST = moment().utcOffset(5.5).startOf('day');

    // Check if a login history entry already exists for the user on this date
    let existingLoginHistory = await LoginHistory.findOne({
      user: user._id,
      loginTime: { $gte: currentDateIST.toDate(), $lt: currentDateIST.add(1, 'day').toDate() }
    });

    // If an entry already exists, update it; otherwise, create a new one
    if (!existingLoginHistory) {
      const loginHistory = new LoginHistory({
        user: user._id,
        loginTime: currentDateIST, // Store in IST
      });
      existingLoginHistory = await loginHistory.save();
    }

    // Remove the password from the user object before sending it in the response
    user.password = undefined;

    const options = {
      expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    };

    return res.cookie("token", token, options).status(200).json({
      success: true,
      token,
      user,
      loginHistory: existingLoginHistory, // Include the login history data in the response
      message: "Logged in successfully",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
});




//logout
exports.logout = catchAsyncErrors(async (req, res) => {
  try {
    // Clear the authentication token (cookie) to log the user out
    res.clearCookie("token");

    // Get the current time in UTC
    const logoutTimeUTC = moment();

    // Add 5.5 hours to convert to IST (Indian Standard Time)
    const logoutTimeIST = logoutTimeUTC.add(5.5, 'hours');

    // Create a new logout history record
    const logoutHistory = new LogoutHistory({
      user: req.user._id, // Assuming you have user information in 'req.user'
      logoutTime: logoutTimeIST, // Store in IST
    });
    await logoutHistory.save();

    res.status(200).json({
      success: true,
      message: "Logout Successful",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
});

//change password
exports.ChangePassword = catchAsyncErrors(async (req, res) => {
  const { email, newPassword } = req.body;

  try {
    // Find the user by their email
    const user = await User.findOne({ email });

    if (!user) {
      throw new ErrorHandler("User not found with this email", 404);
    }

    // Hash the new password before saving it
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update the user's password
    user.password = newPasswordHash;
    await user.save();

    res.status(200).json({
      message: "Password changed successfully.",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});


//Mark Attendenc With Email And Date And time
exports.markAttendance = catchAsyncErrors(async (req, res) => {
  try {
    const { executiveId, date, time, status } = req.body;

    // Combine date and time into a JavaScript Date object (UTC timezone)
    const dateObjectUTC = new Date(date + ' ' + time);

    // Convert the UTC time to IST (Indian Standard Time)
    const indiaTimezone = 'Asia/Kolkata';
    const options = { timeZone: indiaTimezone };
    const dateObjectIST = new Date(dateObjectUTC.toLocaleString('en-IN', options));

    // Check if attendance for the same date and time already exists
    const existingAttendance = await Attendance.findOne({
      executiveId,
      date: dateObjectIST, // Store the date and time as a Date object in IST
    });

    if (existingAttendance) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked for this date and time.',
      });
    }

    // Create a new attendance record with the date and time in IST
    const newAttendance = new Attendance({
      executiveId,
      date: dateObjectIST, // Store the date and time as a Date object in IST
      status,
    });

    await newAttendance.save();

    return res.status(201).json({
      success: true,
      message: 'Attendance marked successfully.',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});




//get user by email
exports.getUserByEmail = catchAsyncErrors(async (req, res) => {
  const { email } = req.params; // Assuming you pass the email as a URL parameter

  try {
    const user = await User.findOne({ email });

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    res.status(200).json({
      message: "User found successfully",
      user,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

exports.getAllExecutive = catchAsyncErrors(async (req, res) => {
  try {
    // Assuming you have a "User" model for executives
    const executives = await user.find();

    if (executives.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No Executives Found',
      });
    } else {
      return res.status(200).json({
        success: true,
        message: 'Executives List',
        executive: executives,
      });
    }
  } catch (error) {
    // Handle any database or server errors here
    console.error('Error fetching executives:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.body; // Assuming the ID is passed in the request body
    const users = await user.findById(id);

    if (!users) {
      return res.status(404).json({
        success: false,
        message: 'users not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'users found',
      users,
    });
  } catch (error) {
    console.error('Error fetching users by ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
};
exports.getAllClientsAdmin = catchAsyncErrors(async (req, res) => {
  try {
    // Fetch a list of clients from the database
    const clients = await Clients.find();

    if (clients.length === 0) {
      // If no clients are found, return a 404 error
      return res.status(404).json({
        success: false,
        message: 'No Clients Found',
      });
    } else {
      // If clients are found, return them in the response
      return res.status(200).json({
        success: true,
        message: 'Client List',
        clients: clients, // Use "clients" instead of "Clients"
      });
    }
  } catch (error) {
    // Handle any database or server errors here
    console.error('Error fetching Clients:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal Server Error',
    });
  }
});
exports.UploadDataCrm = catchAsyncErrors(async (req, res) => {
  try {
    const requestData = req.body;

    if (Array.isArray(requestData)) {
      // Handle multiple data objects
      for (const data of requestData) {
        if (!data.name || !data.company || !data.mobile || !data.dataFor) {
          return res.status(400).json({
            success: false,
            error: "Please fill in all required fields for each data object: name, company, mobile",
          });
        }
        const newExecutiveData = new DataExecutive(data);
        await newExecutiveData.save();
      }
    } else {
      // Handle a single data object
      if (!requestData.name || !requestData.company || !requestData.mobile || requestData.dataFor) {
        return res.status(400).json({
          success: false,
          error: "Please fill in all required fields: name, company, mobile_number",
        });
      }
      const newExecutiveData = new DataExecutive(requestData);
      await newExecutiveData.save();
    }

    return res.status(200).json({ success: true, message: "Data uploaded to CRM successfully" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

exports.getUploadescrmdata = catchAsyncErrors(async (req, res) => {
  try {
    // Extract the 'dataFor' value from the request query parameters
    const dataFor = req.params.dataFor;

    // Check if 'dataFor' is missing
    if (!dataFor) {
      return res.status(400).json({
        success: false,
        error: "Please provide a 'dataFor' value in the query parameters",
      });
    }

    // Query the CRM data based on 'dataFor'
    const crmData = await DataExecutive.find({ dataFor: dataFor });

    if (crmData.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No CRM data found for the specified 'dataFor' value",
      });
    }

    return res.status(200).json({ success: true, data: crmData });
  } catch (error) {
    // Log the error for debugging
    console.error(error);

    // Handle the error and return a proper response
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
// Update the status of CRM data by _id
exports.updateStatus = catchAsyncErrors(async (req, res) => {
  try {
    const dataId = req.params.dataId; // Get the _id from the request params
    const { newStatus } = req.body;

    if (!dataId || newStatus !== 'done') {
      return res.status(400).json({
        success: false,
        error: "Please provide a valid '_id' and 'newStatus' in the request body (newStatus should be 'done').",
      });
    }

    // Check if the status is already "done" for the specified document
    const existingData = await DataExecutive.findById(dataId);

    if (!existingData) {
      return res.status(404).json({
        success: false,
        error: "No CRM data found for the specified '_id'",
      });
    }

    if (existingData.status === 'done') {
      return res.status(400).json({
        success: false,
        error: "Status is already 'done' for this data",
      });
    }

    // Update the status to "done" for the specified document with _id
    const updatedData = await DataExecutive.findOneAndUpdate(
      { _id: dataId },
      { status: 'done' },
      { new: true }
    );

    return res.status(200).json({ success: true, data: updatedData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});

exports.getAllDoneData = catchAsyncErrors(async (req, res) => {
  try {
    const { dataFor } = req.query;

    // Check if the 'dataFor' parameter is provided
    if (!dataFor) {
      return res.status(400).json({
        success: false,
        error: "Please provide a 'dataFor' ID in the query parameters.",
      });
    }

    // Search for data with status 'done' and matching 'dataFor' ID
    const doneData = await DataExecutive.find({
      status: 'done',
      dataFor: dataFor,
    });

    return res.status(200).json({ success: true, data: doneData });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
});
exports.getLoginData = catchAsyncErrors(async (req, res) => {
  try {
    const { executiveId } = req.body; // Assuming 'user' is the executiveId you want to search for
    const loginHistory = await LoginHistory.find({ executiveId: user });

    if (!loginHistory || loginHistory.length === 0) {
      return res.status(401).json({ message: "No login history found for the executive" });
    }

    const loginTimes = loginHistory.map(entry => entry.loginTime);

    res.status(200).json({
      message: "Login history data retrieved successfully",
      loginTimes,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "An error occurred" });
  }
});


//make a function for digital marketer function if package is this then he do this.....