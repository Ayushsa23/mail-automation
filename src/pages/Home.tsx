import { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import EmailCard, { type EmailCategory } from '../components/EmailCard';
import Sidebar from '../components/Sidebar';
import EmailComposeModal from '../components/EmailComposeModal';
import { Filter } from 'lucide-react';

interface Email {
  id: string;
  sender: string;
  subject: string;
  summary: string;
  date: string | Date;
  category: EmailCategory;
  extractedEvents?: string[];
}

export interface HomeRef {
  refresh: () => void;
  isRefreshing: boolean;
}

const Home = forwardRef<HomeRef>((props, ref) => {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<EmailCategory | 'All'>('All');
  const [sortOrder, setSortOrder] = useState<'newest-first' | 'oldest-first'>('oldest-first');
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyTo, setReplyTo] = useState('');
  const [replySubject, setReplySubject] = useState('');
  const [replyOriginalBody, setReplyOriginalBody] = useState('');

  const fetchEmails = async () => {
    try {
      const token = localStorage.getItem('token');
      const password = localStorage.getItem('password');

      if (!token) {
        setError('Not authenticated');
        setLoading(false);
        return;
      }

      if (!password) {
        setError('Password required. Please login again.');
        setLoading(false);
        return;
      }

      let allEmails: any[] = [];
      let batchNumber = 0;
      let isComplete = false;
      const TOTAL_EMAILS = 40;

      setEmails([]);
      setLoading(true);
      setError('');

      const loadingTimeout = setTimeout(() => {
        setLoading(false);
      }, 60000);

      try {
        while (!isComplete && allEmails.length < TOTAL_EMAILS) {
          try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 60000);

          let response: Response;
          try {
            response = await fetch('/api/emails/fetch-progressive', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
                'Cache-Control': 'no-store, no-cache, must-revalidate',
                'Pragma': 'no-cache',
              },
              body: JSON.stringify({ password, batchNumber }),
              signal: controller.signal,
              cache: 'no-store',
            });
            clearTimeout(timeoutId);
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw new Error('Request timed out. Email fetching is taking too long. Please try again.');
            }
            throw fetchError;
          }

          const text = await response.text();
          
          if (!text) {
            throw new Error('Empty response from server. Please check if the server is running.');
          }

          let data;
          try {
            data = JSON.parse(text);
          } catch (parseError) {
            console.error('Failed to parse JSON:', text);
            throw new Error(`Invalid response from server: ${text.substring(0, 100)}`);
          }

          if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch emails');
          }

          const formattedBatch = data.emails.map((email: any) => ({
            ...email,
            date: new Date(email.date),
          }));

          const newEmails = formattedBatch.filter(
            (newEmail: any) => !allEmails.some(existing => existing.id === newEmail.id)
          );

          allEmails = [...allEmails, ...newEmails];
          setEmails([...allEmails]);
          setError('');

          if (batchNumber === 0) {
            setLoading(false);
          }

          isComplete = data.isComplete || allEmails.length >= TOTAL_EMAILS;
          batchNumber++;

          if (!isComplete) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err: any) {
          console.error(`Error fetching batch ${batchNumber + 1}:`, err.message || err);
          setLoading(false);
          if (batchNumber === 0 && allEmails.length === 0) {
            setError(err.message || 'Failed to fetch emails');
          }
          break;
        }
      }

      allEmails.sort((a, b) => a.date.getTime() - b.date.getTime());
      setEmails(allEmails);
      setLoading(false);
      clearTimeout(loadingTimeout);
      } catch (innerErr: any) {
        console.error('Error in batch processing loop:', innerErr.message || innerErr);
        setLoading(false);
        clearTimeout(loadingTimeout);
        throw innerErr;
      }
    } catch (err: any) {
      console.error('Error fetching emails:', err.message || err);
      setError(err.message || 'Failed to fetch emails');
      setLoading(false);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshEmails = async () => {
    const token = localStorage.getItem('token');
    const password = localStorage.getItem('password');

    if (!token || !password) {
      setError('Not authenticated. Please login again.');
      return;
    }

    setRefreshing(true);
    setError('');

    try {
      const newestDate = emails.length > 0
        ? emails.reduce((newest, email) => {
            const emailDate = new Date(email.date as Date);
            const newestDateObj = new Date(newest);
            return emailDate > newestDateObj ? email.date : newest;
          }, emails[0].date)
        : null;

      const knownEmailIds = emails.map(email => email.id);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let response: Response;
      try {
        response = await fetch('/api/emails/fetch-new', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            'Cache-Control': 'no-store, no-cache, must-revalidate',
            'Pragma': 'no-cache',
          },
          body: JSON.stringify({
            password,
            sinceDate: newestDate ? new Date(newestDate).toISOString() : null,
            knownEmailIds,
          }),
          signal: controller.signal,
          cache: 'no-store',
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Request timed out. Please try again.');
        }
        throw fetchError;
      }

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }

      const data = JSON.parse(text);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to fetch new emails');
      }

      const newEmails = data.emails.map((email: any) => ({
        ...email,
        date: new Date(email.date),
      }));

      if (newEmails.length === 0) {
        setRefreshing(false);
        return;
      }

      setEmails(prevEmails => {
        const existingIds = new Set(prevEmails.map(e => e.id));
        const uniqueNewEmails = newEmails.filter((e: any) => !existingIds.has(e.id));

        if (uniqueNewEmails.length === 0) {
          return prevEmails;
        }

        const allEmails = [...prevEmails, ...uniqueNewEmails];
        allEmails.sort((a, b) => {
          const dateA = new Date(a.date as Date);
          const dateB = new Date(b.date as Date);
          return dateA.getTime() - dateB.getTime();
        });

        return allEmails;
      });
    } catch (err: any) {
      console.error('Error refreshing emails:', err.message || err);
      setError(err.message || 'Failed to refresh emails');
    } finally {
      setRefreshing(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: refreshEmails,
    isRefreshing: refreshing,
  }));

  useEffect(() => {
    fetchEmails();
  }, []);

  useEffect(() => {
    if (loading || refreshing) {
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshEmails().catch(err => {
          console.error('Auto-refresh error:', err);
        });
      }
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !refreshing && !loading) {
        refreshEmails().catch(err => {
          console.error('Visibility refresh error:', err);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(pollInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loading, refreshing]);

  const allEvents = emails
    .flatMap((email) => {
      const events = email.extractedEvents || [];
      if (email.category === 'Important-Academics') {
        return events.map(event => {
          if (event.includes('|')) {
            const parts = event.split('|');
            return `${parts[0].trim()} |academic`;
          }
          return `${event} |academic`;
        });
      }
      return events;
    })
    .filter((event, index, self) => self.indexOf(event) === index)
    .slice(0, 10);

  const filteredEmails = selectedCategory === 'All' 
    ? emails 
    : emails.filter(email => email.category === selectedCategory);

  const sortedEmails = [...filteredEmails].sort((a, b) => {
    const dateA = new Date(a.date as Date).getTime();
    const dateB = new Date(b.date as Date).getTime();
    return sortOrder === 'newest-first' 
      ? dateB - dateA
      : dateA - dateB;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <p className="dark:text-gray-400" style={{ color: 'var(--card-text, black)' }}>Loading your emails...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 max-w-md w-full">
          <div className="text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <button
              onClick={() => {
                setRefreshing(true);
                fetchEmails();
              }}
              className="bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Email List - Scrolls with page */}
          <div className="md:col-span-2 space-y-4">
            {/* Filter Dropdown */}
            <div 
              className="rounded-2xl shadow-sm p-4 border border-gray-100 dark:border-gray-700 space-y-4"
              style={{ 
                backgroundColor: 'var(--card-bg, white)',
                color: 'var(--card-text, black)'
              }}
            >
              <div className="flex items-center gap-3">
                <Filter size={20} className="dark:text-gray-400" style={{ color: 'var(--card-text, black)' }} />
                <label htmlFor="category-filter" className="text-sm font-medium dark:text-gray-300" style={{ color: 'var(--card-text, black)' }}>
                  Filter by Category:
                </label>
                <select
                  id="category-filter"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as EmailCategory | 'All')}
                  className="flex-1 px-4 py-2 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  style={{ 
                    color: '#000000',
                    backgroundColor: '#efefef'
                  }}
                >
                  <option value="All" style={{ color: '#000000', backgroundColor: '#ffffff' }}>All Emails</option>
                  <option value="Important-Academics" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Academics</option>
                  <option value="Important-Deadline" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Deadline</option>
                  <option value="Event" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Event</option>
                  <option value="General" style={{ color: '#000000', backgroundColor: '#ffffff' }}>General</option>
                </select>
                {selectedCategory !== 'All' && (
                  <span className="text-xs dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full" style={{ color: 'var(--card-text, black)' }}>
                    {filteredEmails.length} {filteredEmails.length === 1 ? 'email' : 'emails'}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                <label htmlFor="sort-order" className="text-sm font-medium dark:text-gray-300" style={{ color: 'var(--card-text, black)' }}>
                  Sort Order:
                </label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'newest-first' | 'oldest-first')}
                  className="flex-1 px-4 py-2 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-medium dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-all cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  style={{ 
                    color: '#000000',
                    backgroundColor: '#efefef'
                  }}
                >
                  <option value="oldest-first" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Oldest to Newest</option>
                  <option value="newest-first" style={{ color: '#000000', backgroundColor: '#ffffff' }}>Newest to Oldest</option>
                </select>
              </div>
            </div>

            {sortedEmails.length === 0 ? (
              <div 
                className="rounded-2xl shadow-sm p-8 text-center"
                style={{ 
                  backgroundColor: 'var(--card-bg, white)',
                  color: 'var(--card-text, black)'
                }}
              >
                <p className="dark:text-gray-400" style={{ color: 'var(--card-text, black)' }}>
                  {emails.length === 0 
                    ? 'No emails found' 
                    : `No ${selectedCategory === 'All' ? '' : selectedCategory.replace('Important-', '').toLowerCase() + ' '}emails found`}
                </p>
              </div>
            ) : (
                    sortedEmails.map((email, index) => (
                      <EmailCard
                        key={email.id}
                        sender={email.sender}
                        subject={email.subject}
                        summary={email.summary}
                        date={email.date as Date}
                        category={email.category}
                        index={index}
                        originalBody={(email as any).body || ''}
                        onReply={(sender, subject, originalBody) => {
                          setReplyTo(sender);
                          setReplySubject(subject);
                          setReplyOriginalBody(originalBody || '');
                          setReplyModalOpen(true);
                        }}
                      />
                    ))
            )}
          </div>

          <div className="md:col-span-1">
            <Sidebar upcomingDates={allEvents} />
          </div>
        </div>
      </div>

      <EmailComposeModal
        isOpen={replyModalOpen}
        onClose={() => setReplyModalOpen(false)}
        defaultTo={replyTo}
        defaultSubject={replySubject}
        originalEmailBody={replyOriginalBody}
        onSend={async (to, subject, body, password: string) => {
          const token = localStorage.getItem('token');

          if (!token) {
            throw new Error('Not authenticated. Please login again.');
          }

          if (!password) {
            throw new Error('Password is required to send emails.');
          }

          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          try {
            const response = await fetch('/api/emails/send', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                password,
                to,
                subject,
                body,
                replyTo: replyTo || undefined,
              }),
              signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const text = await response.text();
            if (!text) {
              throw new Error('Empty response from server');
            }

            const data = JSON.parse(text);

            if (!response.ok) {
              throw new Error(data.error || data.message || 'Failed to send email');
            }
          } catch (fetchError: any) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
              throw new Error('Request timed out. Please try again.');
            }
            throw fetchError;
          }
        }}
      />
    </div>
  );
});

Home.displayName = 'Home';
export default Home;
