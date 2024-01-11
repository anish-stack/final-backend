const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require('body-parser')
const path = require("path");
const cookieParser = require("cookie-parser");
const ConnectDb = require("./config/database");
const User = require('./modals/executive');
const { RegisterUser, login, logout, markAttendance,getUserByEmail,getAllExecutive,getAllClientsAdmin,getUserById, ChangePassword, UploadDataCrm, getUploadescrmdata,updateStatus, getAllDoneData, getLoginData } = require('./controllers/userController');
const { createClient, followUp, updateClientReport, GetClientByMobileNumber, downloadClientData, downloadAttendance,getClientsByuserid,downloadAllAttendance,downloadClientDataAll,digitalmarketWorks,clientDeleteById, blockClientById } = require('./controllers/clientController');

const bcrypt = require('bcrypt');
const { protect } = require('./middleware/auth');
const sendMail = require('./utility/sendMail');
const configPath = path.resolve(__dirname, "config", "config.env");
dotenv.config({ path: configPath });


// Set up CORS and other middleware
app.use(cors());
app.use(cookieParser());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true }));

// Connect to the database
ConnectDb();

const PORT = process.env.PORT || 4000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});



// Define your routes here
app.post('/Register', RegisterUser);
app.post('/login', login);
app.post('/logout', logout);
app.post('/mark-attendance', markAttendance);
app.post('/create-client', protect, createClient);
app.get('/follow-up-clients', protect, followUp);
app.post('/Change-ClientDetails', protect, updateClientReport);
app.post('/getClientByNumber', GetClientByMobileNumber);
app.get('/Download-client-data/:id', downloadClientData);
app.get('/download-attendance/:employeeId', downloadAttendance);
app.get('/getExecutive/:email',getUserByEmail)
// app.get('/getClients',protect,getClientsByuserid)
app.get('/getExecutive',getAllExecutive)
app.get('/admin/clients',getAllClientsAdmin)
app.post('/executive-details',getUserById)
app.get('/downloadAllAttendance',downloadAllAttendance)
// app.get("/downloadClientDataAll",downloadClientDataAll)
app.get("/getClientsWork",digitalmarketWorks)
app.post("/delete-client/:id",clientDeleteById)
app.post("/block/:id",blockClientById)
app.post("/changepasword",ChangePassword)
app.post("/upload-data",UploadDataCrm)
app.get("/getData/:dataFor",getUploadescrmdata)
app.post("/update/:dataId",updateStatus)
app.get("/done-data",getAllDoneData)
app.post("/get-login",getLoginData)

app.post('/activate', async (req, res) => {
  try {
    const { email, otp } = req.body;

    // Find the user by email
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Compare the provided OTP with the stored OTP hash
    const otpMatch = await bcrypt.compare(otp.toString(), user.otp);

    if (!otpMatch) {
      return res.status(401).json({ message: 'Invalid OTP' });
    }

    // Update the user's "isActivated" status to true
    user.isActivated = true;
    await user.save();
    await sendMail({
        email: user.email,
        subject: "Account Activated Successfully",
        message: `Welcome to DGMT! Your account has been successfully activated. You can now log in and explore our CRM. Thank you for joining DGMT.`,
      });
      
    res.status(200).json({ message: 'Account activated successfully' });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server is running on Port number ${PORT}`);
});