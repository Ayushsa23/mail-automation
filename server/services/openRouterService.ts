import type { EmailCategory, AIResponse } from '../types/index.js';
import dotenv from 'dotenv';

dotenv.config();

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = 'minimax/minimax-m2:free';

/**
 * Analyze email using OpenRouter's MiniMax M2 API
 * Returns categorized email with summary and extracted events
 */
/**
 * Generate email reply using OpenRouter's MiniMax M2 API
 */
export async function generateEmailReply(
  originalSubject: string,
  originalBody: string,
  userPrompt: string,
  refinementRequest?: string,
  currentDraft?: string
): Promise<{ subject: string; body: string }> {
  try {
    const API_KEY = process.env.OPENROUTER_API;
    if (!API_KEY) {
      throw new Error('OPENROUTER_API is not set in environment variables');
    }

    // Truncate original email if too long
    const maxOriginalLength = 2000;
    const truncatedOriginal = originalBody.length > maxOriginalLength
      ? originalBody.substring(0, maxOriginalLength) + '\n[... content truncated ...]'
      : originalBody;

    const prompt = refinementRequest 
      ? `You are an AI email assistant. A user wants to refine their email reply. Here's the context:

ORIGINAL EMAIL:
Subject: ${originalSubject}
Body: ${truncatedOriginal}

ORIGINAL USER INTENT:
${userPrompt}

CURRENT REPLY DRAFT:
${currentDraft || ''}

REFINEMENT REQUEST:
${refinementRequest}

Generate a refined version of the email reply based on the refinement request. Make sure the refined email:
- Maintains the original intent and key points from the user's prompt
- Incorporates the requested refinements
- Is professional and appropriate
- Is ready to send

Return ONLY the email body text. Do not include any explanation or markdown formatting.`

      : `You are an AI email assistant. A user wants to reply to an email. Here's the context:

ORIGINAL EMAIL:
Subject: ${originalSubject}
Body: ${truncatedOriginal}

USER'S PROMPT (what they want to say):
${userPrompt}

Generate a professional email reply based on the user's prompt. The reply should:
- Be professional and appropriate
- Address the original email appropriately
- Convey what the user wants to say
- Be ready to send

Return ONLY the email body text. Do not include any explanation or markdown formatting.`;

    console.log(`[OpenRouter] Generating email reply${refinementRequest ? ' (refinement)' : ''}...`);

    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001',
        'X-Title': 'Mailautomation Email Reply Generator',
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter] API error: ${response.status} ${response.statusText}`);
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}. ${errorText.substring(0, 200)}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (data.error) {
      throw new Error(`OpenRouter API error: ${data.error.message || 'Unknown error'}`);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenRouter API returned no choices');
    }

    const content = data.choices[0]?.message?.content;

    if (!content || content.trim().length === 0) {
      throw new Error('OpenRouter API returned empty response');
    }

    // Clean up the response (remove markdown if present)
    let emailBody = content.trim();
    
    // Remove markdown code blocks if present
    if (emailBody.includes('```')) {
      emailBody = emailBody.replace(/```[\s\S]*?```/g, '').trim();
    }

    // Generate subject (Re: prefix if not already present)
    const replySubject = originalSubject.startsWith('Re:') 
      ? originalSubject 
      : `Re: ${originalSubject}`;

    console.log(`[OpenRouter] Email reply generated successfully`);

    return {
      subject: replySubject,
      body: emailBody,
    };
  } catch (error: any) {
    console.error(`[OpenRouter] Error generating email reply: ${error.message}`);
    throw error;
  }
}

export async function analyzeEmail(
  subject: string,
  body: string
): Promise<AIResponse> {
  try {
    // Validate inputs
    if (!subject && !body) {
      return {
        category: 'General',
        summary: 'No email content to analyze.',
        events: [],
      };
    }

    // Truncate body if too long (model has 204,800 context limit)
    const maxBodyLength = 4000;
    let truncatedBody = body.length > maxBodyLength
      ? body.substring(0, maxBodyLength) + '\n[... content truncated ...]'
      : body;

    // Also truncate subject if it's very long
    const maxSubjectLength = 200;
    const truncatedSubject = subject.length > maxSubjectLength
      ? subject.substring(0, maxSubjectLength) + '...'
      : subject;

    const API_KEY = process.env.OPENROUTER_API;
    if (!API_KEY) {
      throw new Error('OPENROUTER_API is not set in environment variables');
    }

    console.log(`[OpenRouter] Starting content generation for email: "${truncatedSubject.substring(0, 50)}..."`);

    const categorizationPrompt = `You are an email categorization and summarization assistant for IIT Kanpur students.
Analyze the following email and:

1. Categorize it into ONE of these categories:
   - "Important-Academics": Mentions lecture, class, lab, coursework (e.g., "Extra class for ESC201 at 4 PM")
   - "Important-Deadline": Mentions submission, registration, form, deadline (e.g., "Deadline for MTech registration extended")
   - "Event": Mentions meeting, workshop, conference, seminar, schedule (e.g., "CSE seminar on AI – Nov 3")
   - "General": Other mails that don't fit the above categories (e.g., "Wi-Fi downtime notice")

2. Provide a concise summary (2-3 sentences)

3. Extract any upcoming dates/events and categorize each event into one of these types:
   - "exam": Upcoming exams, tests, quizzes (e.g., "Mid-term exam – Oct 30", "End-semester exam – Dec 15")
   - "deadline": Assignment deadlines, submission deadlines, form submission deadlines (e.g., "Assignment submission – Oct 25", "Project deadline – Nov 10")
   - "event": Other events like seminars, workshops, meetings, conferences, competitions (e.g., "CSE seminar – Nov 3", "Workshop on AI – Nov 5")

For each event, return in the format: "Event name – Date | eventType" where eventType is exam, deadline, or event.

Return your response in the following JSON format:
{
  "category": "Important-Academics | Important-Deadline | Event | General",
  "summary": "Brief summary here",
  "events": ["Event 1 – Date | exam", "Event 2 – Date | deadline", "Event 3 – Date | event"] or [] if no events
}`;

    const emailContent = `Subject: ${truncatedSubject}\n\nBody: ${truncatedBody}`;
    const fullPrompt = `${categorizationPrompt}\n\nEmail:\n${emailContent}`;

    console.log(`[OpenRouter] Calling API for model: ${MODEL_NAME}`);

    // Make request to OpenRouter API (OpenAI-compatible)
    const response = await fetch(OPENROUTER_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'HTTP-Referer': process.env.APP_URL || 'http://localhost:3001', // Optional: for analytics
        'X-Title': 'Mailautomation Email Analyzer', // Optional: for analytics
      },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenRouter] API error: ${response.status} ${response.statusText}`);
      console.error(`[OpenRouter] Error details: ${errorText}`);
      
      if (response.status === 401 || response.status === 403) {
        throw new Error(`OpenRouter API authentication failed. Please check your OPENROUTER_API. Status: ${response.status}`);
      }
      
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}. ${errorText.substring(0, 200)}`);
    }

    const data = await response.json() as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
      error?: {
        message?: string;
      };
    };

    if (data.error) {
      throw new Error(`OpenRouter API error: ${data.error.message || 'Unknown error'}`);
    }

    if (!data.choices || data.choices.length === 0) {
      throw new Error('OpenRouter API returned no choices');
    }

    const content = data.choices[0]?.message?.content;

    if (!content || content.trim().length === 0) {
      throw new Error('OpenRouter API returned empty response');
    }

    console.log(`[OpenRouter] Successfully generated content`);

    // Extract JSON from response (handle markdown code blocks if present)
    let jsonText = content.trim();

    // Remove markdown code blocks
    if (jsonText.includes('```json')) {
      jsonText = jsonText.split('```json')[1].split('```')[0].trim();
    } else if (jsonText.includes('```')) {
      jsonText = jsonText.split('```')[1].split('```')[0].trim();
    }

    // Try to find JSON object in the response if it's not already clean JSON
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }

    let parsed: AIResponse;
    try {
      parsed = JSON.parse(jsonText) as AIResponse;
    } catch (parseError) {
      console.error('[OpenRouter] Failed to parse JSON response:', parseError);
      console.error('[OpenRouter] Raw response:', jsonText.substring(0, 500));
      throw new Error(`Failed to parse OpenRouter response as JSON: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    // Validate category
    const validCategories: EmailCategory[] = [
      'Important-Academics',
      'Important-Deadline',
      'Event',
      'General',
    ];

    // Validate category - ensure it's one of the valid categories
    if (!validCategories.includes(parsed.category)) {
      parsed.category = 'General';
    }

    const analysisResult = {
      category: parsed.category,
      summary: parsed.summary || 'No summary available',
      events: parsed.events || [],
    };

    console.log(`[OpenRouter] Content generation completed. Category: ${analysisResult.category}, Events: ${analysisResult.events.length}`);
    return analysisResult;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[OpenRouter] Error analyzing email: ${error.message}`);
      console.error(`[OpenRouter] Error stack:`, error.stack);
    } else {
      console.error('[OpenRouter] Unknown error analyzing email:', error);
    }

    // Return default response on error
    return {
      category: 'General',
      summary: 'Unable to analyze email content.',
      events: [],
    };
  }
}

