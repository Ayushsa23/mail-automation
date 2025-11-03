import Imap from 'imap';
import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';
import type { Email } from '../types/index.js';

/**
 * IIT Kanpur Mail Server Configuration:
 * 
 * IMAP Servers (for email fetching):
 * - qasid.iitk.ac.in: Port 993 (IMAPS) - Internet and Intranet
 * - newmailhost.cc.iitk.ac.in: Port 993 (IMAPS) - Intranet only
 * Webmail Interfaces (for web access):
 * - webmail.iitk.ac.in: Port 443 (HTTPS) - Internet and Intranet
 * - webmail1.iitk.ac.in: Port 443 (HTTPS) - Intranet only
 * 
 * IMPORTANT: This service uses IMAP protocol, which requires port 993 (IMAPS).
 * Port 443 is for HTTPS web interface only, NOT for IMAP connections.
 * 
 * CC recommends using qasid.iitk.ac.in for secure IMAP access.
 */
const WEBMAIL_HOST = process.env.WEBMAIL_HOST || 'qasid.iitk.ac.in';
// IMAP protocol uses port 993 (IMAPS). Port 443 is for HTTPS web interface only.
const WEBMAIL_PORT = parseInt(process.env.WEBMAIL_PORT || '993', 10);

function connectToIMAP(
  email: string,
  password: string
): Promise<Imap> {
  return new Promise((resolve, reject) => {
    // Connect to IITK IMAP server using IMAPS (port 993) with TLS
    // This uses the secure version as recommended by CC
    // NOTE: Port 443 won't work for IMAP - it's only for HTTPS web interface
    if (WEBMAIL_PORT === 443) {
      console.warn(`Warning: Port 443 is for HTTPS web interface, not IMAP. IMAP requires port 993.`);
    }
    
    // Extract username without @iitk.ac.in for IMAP authentication
    const imapUsername = email.includes('@') ? email.split('@')[0] : email;
    
    const imap = new Imap({
      user: imapUsername,
      password: password,
      host: WEBMAIL_HOST,
      port: WEBMAIL_PORT, // Default: 993 (IMAPS)
      tls: true, // Use TLS for secure connection
      tlsOptions: { rejectUnauthorized: false },
      connTimeout: 30000, // 30 seconds connection timeout
    });
    

    // Set a timeout for the connection
    const connectionTimeout = setTimeout(() => {
      imap.end();
      reject(new Error('Connection to email server timed out. Please check your network connection.'));
    }, 30000); // 30 seconds

    imap.once('ready', () => {
      clearTimeout(connectionTimeout);
      resolve(imap);
    });

    imap.once('error', (err: Error) => {
      clearTimeout(connectionTimeout);
      console.error('IMAP error:', err.message);
      let errorMessage = err.message;
      
      // Provide more helpful error messages
      if (WEBMAIL_PORT === 443) {
        errorMessage = `Cannot connect to ${WEBMAIL_HOST}:${WEBMAIL_PORT}. Port 443 is for HTTPS web interface, not IMAP. Use port 993 for IMAP connections. Original error: ${err.message}`;
      } else if (WEBMAIL_HOST.includes('webmail') && !WEBMAIL_HOST.includes('qasid') && !WEBMAIL_HOST.includes('newmailhost')) {
        errorMessage = `Connection failed to ${WEBMAIL_HOST}. Note: webmail.iitk.ac.in is the web interface, not an IMAP server. Try using qasid.iitk.ac.in for IMAP. Original error: ${err.message}`;
      }
      
      reject(new Error(errorMessage));
    });

    imap.connect();
  });
}

function fetchEmails(imap: Imap): Promise<Email[]> {
  return new Promise((resolve, reject) => {
    imap.openBox('INBOX', true, (err: Error | null, box?: Imap.Box) => {
      if (err) {
        console.error('Error opening INBOX:', err.message);
        reject(err);
        return;
      }

      // Search for all emails - IMAP returns them in reverse chronological order (newest first)
      imap.search(['ALL'], (err: Error | null, results?: number[]) => {
        if (err) {
          reject(err);
          return;
        }

        if (!results || results.length === 0) {
          fetchEmailDetails(imap, [], resolve, reject);
          return;
        }

        const sortedResults = results.slice().reverse();
        const last40Results = sortedResults.slice(0, 40);
        
        fetchEmailDetails(imap, last40Results, resolve, reject);
      });
    });
  });
}

function fetchEmailDetails(
  imap: Imap,
  results: number[],
  resolve: (emails: Email[]) => void,
  reject: (error: Error) => void
) {
  if (results.length === 0) {
    resolve([]);
    return;
  }

  const emails: Email[] = [];
  const fetch = imap.fetch(results, { 
    bodies: '',
    struct: true
  });

  // Add timeout for fetching emails (45 seconds)
  const fetchTimeout = setTimeout(() => {
    try {
      imap.end();
    } catch (e) {
      // Ignore errors when closing
    }
    reject(new Error('Email fetch operation timed out'));
  }, 45000);

  fetch.on('message', (msg: Imap.ImapMessage, seqno: number) => {
    let emailBuffer = '';
    let imapDate: Date | null = null;

    // Try to get date from attributes (IMAP server's internal date)
    // This fires before body parsing and provides the most reliable date
    msg.once('attributes', (attrs: Imap.ImapMessageAttributes) => {
      if (attrs.date) {
        imapDate = attrs.date;
      }
    });

    msg.on('body', (stream: NodeJS.ReadableStream) => {
      stream.on('data', (chunk: Buffer) => {
        emailBuffer += chunk.toString('utf8');
      });
    });

    msg.once('end', async () => {
      try {
        const parsed: ParsedMail = await simpleParser(emailBuffer);
        
        // Priority: IMAP server date > parsed email date > current date
        // IMAP server date is most reliable as it's when the server received the email
        // parsed.date comes from email headers which can be spoofed or incorrect
        let finalDate = imapDate || parsed.date || new Date();
        
        
        // Ensure finalDate is a valid Date object
        if (!(finalDate instanceof Date)) {
          finalDate = new Date(finalDate);
        }
        
        // Validate the date
        if (isNaN(finalDate.getTime())) {
          finalDate = new Date();
        }
        
        const email: Email = {
          // Generate a stable ID: use messageId if available, otherwise use a combination of
          // subject, date, and sender to create a stable identifier
          id: parsed.messageId || `email-${seqno}-${parsed.subject?.substring(0, 20) || 'no-subject'}-${finalDate.getTime()}-${parsed.from?.text?.substring(0, 20) || 'no-sender'}`.replace(/[^a-zA-Z0-9-]/g, '-'),
          sender: parsed.from?.text || 'Unknown Sender',
          subject: parsed.subject || '(No Subject)',
          body: parsed.text || parsed.html || '',
          date: finalDate,
        };
        emails.push(email);
      } catch (err: unknown) {
        console.error(`Error parsing email ${seqno}:`, err);
      }
    });
  });

  fetch.once('error', (err: Error) => {
    clearTimeout(fetchTimeout);
    reject(err);
  });

  fetch.once('end', () => {
    clearTimeout(fetchTimeout);
    imap.end();
    resolve(emails);
  });
}

export async function fetchUserEmails(
  email: string,
  password: string,
  days: number = 5
): Promise<Email[]> {
  // Add overall timeout for the entire operation (3 minutes to allow for AI analysis)
  // With parallel processing and unlimited RPM, this should complete much faster
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Email fetching operation timed out. The server may be slow or unresponsive.'));
    }, 180000); // 3 minutes total timeout (should complete much faster with parallel processing)
  });
  const fetchPromise = (async () => {
    // ALWAYS create a new IMAP connection - never reuse connections
    // This ensures we get fresh data from the mail server
    console.log(`[Email Service] Creating new IMAP connection for ${email}...`);
    const imap = await connectToIMAP(email, password);
    try {
      // Fetch last 40 emails directly from IMAP (no caching)
      console.log(`[Email Service] Fetching emails directly from IMAP server...`);
      const emails = await fetchEmails(imap);
      
      if (emails.length > 0) {
        const validDates: string[] = [];
        emails.forEach(e => {
          try {
            const d = new Date(e.date);
            if (!isNaN(d.getTime())) {
              validDates.push(d.toISOString().split('T')[0]);
            } else {
            }
          } catch (err) {
            // Silent fail for date parsing errors
          }
        });
      }
      
      // Return all fetched emails (no date filtering)
      return emails;
    } catch (error) {
      // Ensure IMAP connection is closed on error
      try {
        imap.end();
      } catch (e) {
        // Ignore errors when closing
      }
      throw error;
    }
  })();

  return Promise.race([fetchPromise, timeoutPromise]);
}

