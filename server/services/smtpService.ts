import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

const MMTP_HOST = process.env.MMTP_HOST || 'smtp.iitk.ac.in';
const MMTP_PORT = parseInt(process.env.MMTP_PORT || '465', 10); // MMTP uses port 465 with SSL/TLS

/**
 * Send email using MMTP (Message Management Transfer Protocol)
 */
export async function sendEmail(
  fromEmail: string,
  fromPassword: string,
  to: string,
  subject: string,
  body: string,
  replyTo?: string
): Promise<void> {
  let transporter: any = null;
  
  try {
    // Validate inputs
    if (!fromEmail || !fromPassword || !to || !subject || !body) {
      throw new Error('Missing required email fields: fromEmail, fromPassword, to, subject, body');
    }

    // Extract username without @iitk.ac.in for SMTP authentication (similar to IMAP)
    const smtpUsername = fromEmail.includes('@') ? fromEmail.split('@')[0] : fromEmail;

    console.log(`[MMTP] Attempting to send email from ${fromEmail} to ${to}`);
    console.log(`[MMTP] Using MMTP server: ${MMTP_HOST}:${MMTP_PORT}`);
    console.log(`[MMTP] MMTP username: ${smtpUsername}`);

    // Create transporter
    // MMTP uses port 465 with SSL/TLS (secure: true)
    transporter = nodemailer.createTransport({
      host: MMTP_HOST,
      port: MMTP_PORT,
      secure: true, // Port 465 uses SSL/TLS directly
      auth: {
        user: smtpUsername, // Use username without domain for authentication
        pass: fromPassword,
      },
      tls: {
        rejectUnauthorized: false, // For self-signed certificates
      },
      connectionTimeout: 30000, // 30 seconds
      greetingTimeout: 30000, // 30 seconds
      socketTimeout: 30000, // 30 seconds
    });

    // Verify connection
    console.log('[MMTP] Verifying MMTP connection...');
    await transporter.verify();
    console.log('[MMTP] MMTP server connection verified successfully');

    // Send mail
    // Use full email address in "from" field, but username-only for auth
    const mailOptions = {
      from: fromEmail, // Full email address for the "From" header
      to: to,
      subject: subject,
      html: body, // Send as HTML to preserve formatting
      text: body.replace(/<[^>]*>/g, ''), // Plain text version (strip HTML tags)
      replyTo: replyTo || fromEmail,
    };

    console.log('[MMTP] Sending email...');
    const info = await transporter.sendMail(mailOptions);
    console.log(`[MMTP] Email sent successfully!`);
    console.log(`[MMTP] Message ID: ${info.messageId}`);
    console.log(`[MMTP] Response: ${info.response}`);

    // Close transporter connection
    transporter.close();
  } catch (error: any) {
    console.error('[MMTP] Error sending email:', error);
    console.error('[MMTP] Error details:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      errno: error.errno,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
    });
    
    // Ensure transporter is closed on error
    if (transporter) {
      try {
        transporter.close();
      } catch (closeError) {
        console.error('[MMTP] Error closing transporter:', closeError);
      }
    }
    
    // Provide more helpful error messages
    let errorMessage = error.message || 'Unknown error';
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      errorMessage = 'Authentication failed. Please check your CC password. Make sure you are using your CC account password (not your email password).';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = `Connection failed. Cannot connect to MMTP server ${MMTP_HOST}:${MMTP_PORT}. Please check your network connection.`;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = `Connection timed out. The MMTP server ${MMTP_HOST}:${MMTP_PORT} did not respond in time.`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = `MMTP server host not found: ${MMTP_HOST}. Please check your MMTP_HOST environment variable.`;
    } else if (error.responseCode === 550) {
      errorMessage = 'Mailbox unavailable or recipient address rejected. Please check the recipient email address.';
    } else if (error.message && error.message.includes('Invalid login')) {
      errorMessage = 'Invalid login credentials. Please check your email and CC password.';
    }
    
    throw new Error(`Failed to send email: ${errorMessage}`);
  }
}

