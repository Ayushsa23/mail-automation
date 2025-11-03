export interface Email {
  id: string;
  sender: string;
  subject: string;
  body: string;
  date: Date;
  category?: EmailCategory;
  summary?: string;
  extractedEvents?: string[];
}

export type EmailCategory = 
  | 'Important-Academics'
  | 'Important-Deadline'
  | 'Event'
  | 'General';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AIResponse {
  category: EmailCategory;
  summary: string;
  events?: string[];
}

export interface User {
  email: string;
  id: string;
}

