import express from 'express';
import { fetchUserEmails } from '../services/emailService.js';
import { generateToken } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = express.Router();

// Login with IITK webmail credentials
router.post('/login', asyncHandler(async (req, res) => {
  console.log('Login request received');
  
  try {
    const { email, password } = req.body;

    console.log('Request body received:', { email: email ? `${email.substring(0, 5)}...` : 'missing', hasPassword: !!password });

    if (!email || !password) {
      console.log('Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email to ensure it has @iitk.ac.in domain
    const normalizedEmail = email.includes('@') ? email : `${email}@iitk.ac.in`;
    
    // Validate email format (should be IITK email)
    if (!normalizedEmail.endsWith('@iitk.ac.in')) {
      console.log('Invalid email format:', normalizedEmail);
      return res.status(400).json({ error: 'Invalid IITK email address' });
    }

    console.log('Attempting to authenticate with IMAP server...');
    
    // Test credentials by attempting to fetch emails
    // This will fail if credentials are invalid
    try {
      // Fetch just 1 email to verify credentials work
      await fetchUserEmails(normalizedEmail, password, 1);
      console.log('IMAP authentication successful');
    } catch (error: any) {
      console.error('Authentication error:', error.message);
      console.error('Error stack:', error.stack);
      return res.status(401).json({ 
        error: 'Invalid credentials or unable to connect to webmail server',
        details: error.message 
      });
    }

    // Generate JWT token with normalized email
    const token = generateToken(normalizedEmail);
    console.log('Token generated successfully');

    const responseData = {
      success: true,
      token,
      user: {
        email: normalizedEmail,
        id: normalizedEmail,
      },
    };

    console.log('Sending successful login response');
    return res.json(responseData);
  } catch (error: any) {
    console.error('Unexpected error in login handler:', error);
    console.error('Error stack:', error.stack);
    // This should be caught by asyncHandler, but just in case
    if (!res.headersSent) {
      return res.status(500).json({ 
        error: 'Internal server error during login',
        message: error.message 
      });
    }
  }
}));

export default router;

