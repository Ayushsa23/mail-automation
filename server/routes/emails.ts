import express from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth.js';
import { fetchUserEmails } from '../services/emailService.js';
import { analyzeEmail } from '../services/openRouterService.js';
import { sendEmail } from '../services/smtpService.js';
import { generateEmailReply } from '../services/openRouterService.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import type { Email, EmailCategory } from '../types/index.js';

const router = express.Router();

// Get emails (fetches, analyzes, and returns)
router.get('/', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { email } = req.user!;
  const { password } = req.body;

  // In a real app, you'd store the password securely or use OAuth
  // For now, we'll need to get it from the request
  // This is a security concern - in production, use OAuth or session-based auth
  
  if (!password) {
    return res.status(400).json({ 
      error: 'Password required to fetch emails. Please re-login.' 
    });
  }

  const rawEmails = await fetchUserEmails(email, password);

  if (rawEmails.length === 0) {
    return res.json({
      success: true,
      emails: [],
      count: 0,
    });
  }

  // Process emails in batches of 2
  console.log(`[Email Processing] Starting to process ${rawEmails.length} emails in batches of 2`);
  const processedEmails: Email[] = [];
  const BATCH_SIZE = 2;
  
  for (let i = 0; i < rawEmails.length; i += BATCH_SIZE) {
    const batch = rawEmails.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rawEmails.length / BATCH_SIZE);
    
    console.log(`[Email Processing] Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);
    
    // Process batch of 2 emails concurrently
    const batchResults = await Promise.all(
      batch.map(async (email, batchIndex) => {
        try {
          // Check cache first
          if (emailSummaryCache.has(email.id)) {
            const cached = emailSummaryCache.get(email.id)!;
            console.log(`[Email Processing] Using cached summary for email: ${email.id}`);
            return {
              ...email,
              category: cached.category,
              summary: cached.summary,
              extractedEvents: cached.extractedEvents,
            };
          }

          console.log(`[Email Processing] Analyzing email ${i + batchIndex + 1}/${rawEmails.length}: "${email.subject.substring(0, 50)}..."`);
          const analysis = await analyzeEmail(email.subject, email.body);
          console.log(`[Email Processing] Successfully analyzed email ${i + batchIndex + 1}/${rawEmails.length}`);
          
          // Cache the result
          emailSummaryCache.set(email.id, {
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          });

          return {
            ...email,
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          };
        } catch (error: any) {
          console.error(`[Email Processing] Error analyzing email ${i + batchIndex + 1}/${rawEmails.length}:`, error?.message || error);
          
          const defaultResult = {
            ...email,
            category: 'General' as const,
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          };

          // Cache even errors to avoid re-processing
          emailSummaryCache.set(email.id, {
            category: 'General',
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          });

          return defaultResult;
        }
      })
    );
    
    processedEmails.push(...batchResults);
    console.log(`[Email Processing] Batch ${batchNumber}/${totalBatches} completed`);
  }
  
  console.log(`[Email Processing] All ${processedEmails.length} emails processed successfully`);

  // Sort by date (old to new - chronological order)
  processedEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  res.json({
    success: true,
    emails: processedEmails,
    count: processedEmails.length,
  });
}));

// In-memory cache for email summaries (by email ID)
const emailSummaryCache = new Map<string, {
  category: EmailCategory;
  summary: string;
  extractedEvents: string[];
}>();

// Fetch only new emails (since last email date)
router.post('/fetch-new', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { email } = req.user!;
  const { password, sinceDate, knownEmailIds = [] } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Set cache-control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  console.log(`[Email Refresh] Fetching new emails since: ${sinceDate || 'beginning'}`);
  console.log(`[Email Refresh] Known email IDs count: ${knownEmailIds.length}`);

  // ALWAYS fetch fresh from IMAP server (no caching of email list)
  console.log(`[Email Refresh] 🔄 Connecting to IMAP server to fetch fresh emails...`);
  const rawEmails = await fetchUserEmails(email, password);
  console.log(`[Email Refresh] ✅ Fetched ${rawEmails.length} emails directly from IMAP server`);
  
  // Filter for new emails - always check by ID first (more reliable than date)
  let newEmails: Email[] = [];
  
  if (knownEmailIds.length > 0) {
    // If we have known emails, filter by ID (more reliable)
    newEmails = rawEmails.filter(email => !knownEmailIds.includes(email.id));
    console.log(`[Email Refresh] Filtered by ID: ${newEmails.length} new emails`);
  } else if (sinceDate) {
    // Fallback to date comparison if no known IDs
    const since = new Date(sinceDate);
    newEmails = rawEmails.filter(email => {
      const emailDate = new Date(email.date);
      return emailDate > since;
    });
    console.log(`[Email Refresh] Filtered by date: ${newEmails.length} new emails`);
  } else {
    // If no known IDs and no sinceDate, return all emails (first load scenario)
    newEmails = rawEmails;
    console.log(`[Email Refresh] No filter applied: returning all ${newEmails.length} emails`);
  }

  // Sort old-to-new (chronological order)
  newEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log(`[Email Refresh] Found ${newEmails.length} new emails`);

  // Process only new emails (reuse cache for existing ones)
  const processedEmails: Email[] = [];
  const BATCH_SIZE = 2;

  for (let i = 0; i < newEmails.length; i += BATCH_SIZE) {
    const batch = newEmails.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async (email) => {
        // Check cache first
        if (emailSummaryCache.has(email.id)) {
          const cached = emailSummaryCache.get(email.id)!;
          console.log(`[Email Refresh] Using cached summary for email: ${email.id}`);
          return {
            ...email,
            category: cached.category,
            summary: cached.summary,
            extractedEvents: cached.extractedEvents,
          };
        }

        // Analyze new email
        try {
          console.log(`[Email Refresh] Analyzing new email: "${email.subject.substring(0, 50)}..."`);
          const analysis = await analyzeEmail(email.subject, email.body);
          
          // Cache the result
          emailSummaryCache.set(email.id, {
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          });

          return {
            ...email,
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          };
        } catch (error: any) {
          console.error(`[Email Refresh] Error analyzing email:`, error?.message || error);
          
          const defaultResult = {
            ...email,
            category: 'General' as const,
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          };

          // Cache even errors to avoid re-processing
          emailSummaryCache.set(email.id, {
            category: 'General',
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          });

          return defaultResult;
        }
      })
    );

    processedEmails.push(...batchResults);
  }

  // Sort old-to-new (chronological order)
  processedEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  console.log(`[Email Refresh] Processed ${processedEmails.length} new emails`);

  console.log(`[Email Refresh] ✅ Returning ${processedEmails.length} new emails to frontend`);
  
  res.json({
    success: true,
    emails: processedEmails,
    count: processedEmails.length,
    newestDate: processedEmails.length > 0 
      ? processedEmails[processedEmails.length - 1].date.toISOString()
      : sinceDate,
    timestamp: new Date().toISOString(), // Add timestamp for debugging
  });
}));

// Progressive loading endpoint - fetches and processes in batches of 4
// Note: This fetches all emails from IMAP on first call, then processes them in batches
router.post('/fetch-progressive', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { email } = req.user!;
  const { password, batchNumber = 0 } = req.body;

  // Set cache-control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const BATCH_SIZE = 4;
  const TOTAL_EMAILS = 40;
  const startIndex = batchNumber * BATCH_SIZE;

  const rawEmails = await fetchUserEmails(email, password);
  
  const limitedEmails = rawEmails.slice(0, TOTAL_EMAILS);

  if (limitedEmails.length === 0) {
    return res.json({
      success: true,
      emails: [],
      count: 0,
      isComplete: true,
      totalFetched: 0,
      totalExpected: 0,
    });
  }

  if (startIndex >= limitedEmails.length) {
    return res.json({
      success: true,
      emails: [],
      count: 0,
      isComplete: true,
      totalFetched: limitedEmails.length,
      totalExpected: limitedEmails.length,
    });
  }

  // Get current batch of 4 emails
  const batch = limitedEmails.slice(startIndex, startIndex + BATCH_SIZE);
  
  console.log(`[Email Processing] Processing batch ${batchNumber + 1} (emails ${startIndex + 1}-${startIndex + batch.length} of ${limitedEmails.length})`);

  // Process batch of 4 emails concurrently (2 at a time within the batch)
  const processedEmails: Email[] = [];
  
  // Process 2 at a time within the batch of 4
  for (let i = 0; i < batch.length; i += 2) {
    const subBatch = batch.slice(i, i + 2);
    const subBatchResults = await Promise.all(
      subBatch.map(async (email, batchIndex) => {
        try {
          // Check cache first
          if (emailSummaryCache.has(email.id)) {
            const cached = emailSummaryCache.get(email.id)!;
            console.log(`[Email Processing] Using cached summary for email: ${email.id}`);
            return {
              ...email,
              category: cached.category,
              summary: cached.summary,
              extractedEvents: cached.extractedEvents,
            };
          }

          const emailIndex = startIndex + i + batchIndex + 1;
          console.log(`[Email Processing] Analyzing email ${emailIndex}/${limitedEmails.length}: "${email.subject.substring(0, 50)}..."`);
          const analysis = await analyzeEmail(email.subject, email.body);
          console.log(`[Email Processing] Successfully analyzed email ${emailIndex}/${limitedEmails.length}`);
          
          // Cache the result
          emailSummaryCache.set(email.id, {
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          });

          return {
            ...email,
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          };
        } catch (error: any) {
          console.error(`[Email Processing] Error analyzing email:`, error?.message || error);
          
          const defaultResult = {
            ...email,
            category: 'General' as const,
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          };

          // Cache even errors to avoid re-processing
          emailSummaryCache.set(email.id, {
            category: 'General',
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          });

          return defaultResult;
        }
      })
    );
    
    processedEmails.push(...subBatchResults);
  }

  console.log(`[Email Processing] Batch ${batchNumber + 1} completed (${processedEmails.length} emails)`);

  // Sort by date (old to new - chronological order)
  processedEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  const isComplete = startIndex + batch.length >= limitedEmails.length;

  res.json({
    success: true,
    emails: processedEmails,
    count: processedEmails.length,
    batchNumber: batchNumber + 1,
    isComplete,
    totalFetched: startIndex + processedEmails.length,
    totalExpected: limitedEmails.length,
  });
}));

// Alternative endpoint that accepts password in request (original - kept for compatibility)
router.post('/fetch', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { email } = req.user!;
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  const rawEmails = await fetchUserEmails(email, password);

  if (rawEmails.length === 0) {
    return res.json({
      success: true,
      emails: [],
      count: 0,
    });
  }

  // Process emails in batches of 2
  console.log(`[Email Processing] Starting to process ${rawEmails.length} emails in batches of 2`);
  const processedEmails: Email[] = [];
  const BATCH_SIZE = 2;
  
  for (let i = 0; i < rawEmails.length; i += BATCH_SIZE) {
    const batch = rawEmails.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rawEmails.length / BATCH_SIZE);
    
    console.log(`[Email Processing] Processing batch ${batchNumber}/${totalBatches} (${batch.length} emails)`);
    
    // Process batch of 2 emails concurrently
    const batchResults = await Promise.all(
      batch.map(async (email, batchIndex) => {
        try {
          // Check cache first
          if (emailSummaryCache.has(email.id)) {
            const cached = emailSummaryCache.get(email.id)!;
            console.log(`[Email Processing] Using cached summary for email: ${email.id}`);
            return {
              ...email,
              category: cached.category,
              summary: cached.summary,
              extractedEvents: cached.extractedEvents,
            };
          }

          console.log(`[Email Processing] Analyzing email ${i + batchIndex + 1}/${rawEmails.length}: "${email.subject.substring(0, 50)}..."`);
          const analysis = await analyzeEmail(email.subject, email.body);
          console.log(`[Email Processing] Successfully analyzed email ${i + batchIndex + 1}/${rawEmails.length}`);
          
          // Cache the result
          emailSummaryCache.set(email.id, {
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          });

          return {
            ...email,
            category: analysis.category,
            summary: analysis.summary,
            extractedEvents: analysis.events || [],
          };
        } catch (error: any) {
          console.error(`[Email Processing] Error analyzing email ${i + batchIndex + 1}/${rawEmails.length}:`, error?.message || error);
          
          const defaultResult = {
            ...email,
            category: 'General' as const,
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          };

          // Cache even errors to avoid re-processing
          emailSummaryCache.set(email.id, {
            category: 'General',
            summary: 'Unable to analyze email content.',
            extractedEvents: [],
          });

          return defaultResult;
        }
      })
    );
    
    processedEmails.push(...batchResults);
    console.log(`[Email Processing] Batch ${batchNumber}/${totalBatches} completed`);
  }
  
  console.log(`[Email Processing] All ${processedEmails.length} emails processed successfully`);

  // Sort by date (old to new - chronological order)
  processedEmails.sort((a, b) => a.date.getTime() - b.date.getTime());

  res.json({
    success: true,
    emails: processedEmails,
    count: processedEmails.length,
  });
}));

// Generate email reply endpoint
router.post('/generate-reply', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { originalSubject, originalBody, userPrompt, refinementRequest, currentDraft } = req.body;

  // Set cache-control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (!originalSubject || !originalBody || !userPrompt) {
    return res.status(400).json({
      error: 'Missing required fields: originalSubject, originalBody, and userPrompt are required'
    });
  }

  try {
    console.log(`[Email Reply] Generating reply for subject: "${originalSubject.substring(0, 50)}..."`);
    const reply = await generateEmailReply(
      originalSubject,
      originalBody,
      userPrompt,
      refinementRequest,
      currentDraft
    );
    
    res.json({
      success: true,
      subject: reply.subject,
      body: reply.body,
    });
  } catch (error: any) {
    console.error(`[Email Reply] Error:`, error.message);
    res.status(500).json({
      error: 'Failed to generate email reply',
      message: error.message,
    });
  }
}));

// Send email endpoint
router.post('/send', authenticateToken, asyncHandler(async (req: AuthRequest, res) => {
  const { email } = req.user!;
  const { password, to, subject, body, replyTo } = req.body;

  // Set cache-control headers to prevent caching
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (!password) {
    return res.status(400).json({ error: 'Password is required to send emails' });
  }

  if (!to || !subject || !body) {
    return res.status(400).json({ 
      error: 'Missing required fields: to, subject, and body are required' 
    });
  }

  try {
    console.log(`[Email Send] Attempting to send email from ${email} to ${to}`);
    await sendEmail(email, password, to, subject, body, replyTo);
    
    res.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error: any) {
    console.error(`[Email Send] Error:`, error.message);
    res.status(500).json({
      error: 'Failed to send email',
      message: error.message,
    });
  }
}));

export default router;

