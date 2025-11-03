import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Mail, Sparkles, RefreshCw, Lock } from 'lucide-react';

interface EmailComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (to: string, subject: string, body: string, password: string) => Promise<void>;
  defaultTo: string;
  defaultSubject: string;
  originalEmailBody?: string;
}

export default function EmailComposeModal({
  isOpen,
  onClose,
  onSend,
  defaultTo,
  defaultSubject,
  originalEmailBody = '',
}: EmailComposeModalProps) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [userPrompt, setUserPrompt] = useState('');
  const [originalUserPrompt, setOriginalUserPrompt] = useState('');
  const [refinementRequest, setRefinementRequest] = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [showRefineInput, setShowRefineInput] = useState(false);
  const [step, setStep] = useState<'prompt' | 'generated' | 'refining'>('prompt');
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [sendSuccess, setSendSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTo(defaultTo);
      setSubject(defaultSubject.startsWith('Re:') ? defaultSubject : `Re: ${defaultSubject}`);
      setBody('');
      setUserPrompt('');
      setOriginalUserPrompt('');
      setRefinementRequest('');
      setShowRefineInput(false);
      setStep('prompt');
      setError('');
      setShowPasswordPrompt(false);
      setPassword('');
      setPasswordError('');
      setSendSuccess(false);
    }
  }, [isOpen, defaultTo, defaultSubject]);

  const generateReply = async (isRefinement = false) => {
    if (!isRefinement && !userPrompt.trim()) {
      setError('Please enter what you want to say in your reply');
      return;
    }

    if (isRefinement && !refinementRequest.trim()) {
      setError('Please enter what you want to refine');
      return;
    }

    setError('');
    setGenerating(true);
    setStep(isRefinement ? 'refining' : 'generated');

    if (!isRefinement) {
      setOriginalUserPrompt(userPrompt);
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Not authenticated. Please login again.');
      }

             const response = await fetch('/api/emails/generate-reply', {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
                 Authorization: `Bearer ${token}`,
                 'Cache-Control': 'no-store, no-cache, must-revalidate',
                 'Pragma': 'no-cache',
               },
               body: JSON.stringify({
                 originalSubject: defaultSubject,
                 originalBody: originalEmailBody,
                 userPrompt: isRefinement ? originalUserPrompt : userPrompt,
                 refinementRequest: isRefinement ? refinementRequest : undefined,
                 currentDraft: isRefinement ? body : undefined,
               }),
               cache: 'no-store',
             });

      const text = await response.text();
      if (!text) {
        throw new Error('Empty response from server');
      }

      const data = JSON.parse(text);

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Failed to generate reply');
      }

      setSubject(data.subject || subject);
      setBody(data.body || '');
      setRefinementRequest('');
      setShowRefineInput(false);
      setStep('generated');
    } catch (err: any) {
      setError(err.message || 'Failed to generate email reply');
      setStep('prompt');
    } finally {
      setGenerating(false);
    }
  };

  const handleSendClick = () => {
    if (!to.trim() || !subject.trim() || !body.trim()) {
      setError('Please generate a reply first');
      return;
    }

    setPassword('');
    setPasswordError('');
    setShowPasswordPrompt(true);
  };

  const handleConfirmSend = async () => {
    if (!password.trim()) {
      setPasswordError('Password is required');
      return;
    }

    setPasswordError('');
    setSendSuccess(false);
    setSending(true);

    try {
      await onSend(to, subject, body, password);
      setSendSuccess(true);
      setPasswordError('');
      
      setTimeout(() => {
        setTo(defaultTo);
        setSubject(defaultSubject.startsWith('Re:') ? defaultSubject : `Re: ${defaultSubject}`);
        setBody('');
        setUserPrompt('');
        setPassword('');
        setStep('prompt');
        setShowPasswordPrompt(false);
        setSendSuccess(false);
        onClose();
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to send email');
      setSendSuccess(false);
    } finally {
      setSending(false);
    }
  };

  const handleRefine = () => {
    setShowRefineInput(true);
    setRefinementRequest('');
  };

  const handleClose = () => {
    if (!sending && !generating) {
      setError('');
      setBody('');
      setUserPrompt('');
      setRefinementRequest('');
      setStep('prompt');
      setShowRefineInput(false);
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-500/40 rounded-lg">
                    <Mail size={20} className="text-blue-600 dark:text-blue-300" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">AI Reply Generator</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {step === 'prompt' ? 'Tell me what you want to say' : 
                       step === 'refining' ? 'Refining your email...' : 
                       'Review your generated reply'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  disabled={sending || generating}
                  className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 dark:bg-red-500/30 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                {/* To Field - Always visible */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    To:
                  </label>
                  <input
                    type="email"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                    disabled={sending || generating}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-300 focus:border-transparent outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
                    placeholder="recipient@example.com"
                  />
                </div>

                {/* Step 1: User Prompt Input */}
                {step === 'prompt' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      What do you want to say in your reply? *
                    </label>
                    <textarea
                      value={userPrompt}
                      onChange={(e) => setUserPrompt(e.target.value)}
                      disabled={generating}
                      rows={6}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-300 focus:border-transparent outline-none resize-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      placeholder="e.g., Thank you for the email. I will attend the meeting on Monday at 3 PM..."
                    />
                  </div>
                )}

                {/* Generated Email Preview */}
                {(step === 'generated' || step === 'refining') && (
                  <>
                    {/* Subject Field */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subject:
                      </label>
                      <input
                        type="text"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        disabled={sending || generating}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-300 focus:border-transparent outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        placeholder="Email subject"
                      />
                    </div>

                    {/* Generated Body */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Generated Message:
                      </label>
                      {generating && step === 'refining' ? (
                        <div className="w-full px-4 py-8 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 flex items-center justify-center">
                          <div className="text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-2"></div>
                            <p className="text-gray-600 dark:text-gray-400 text-sm">Refining your email...</p>
                          </div>
                        </div>
                      ) : (
                        <textarea
                          value={body}
                          onChange={(e) => setBody(e.target.value)}
                          disabled={sending || generating}
                          rows={12}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-300 focus:border-transparent outline-none resize-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
                          placeholder="Generated email will appear here..."
                        />
                      )}
                    </div>

                    {/* Refinement Input */}
                    {showRefineInput && step === 'generated' && !generating && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          What would you like to refine? *
                        </label>
                        <textarea
                          value={refinementRequest}
                          onChange={(e) => setRefinementRequest(e.target.value)}
                          disabled={generating}
                          rows={4}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-300 focus:border-transparent outline-none resize-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
                          placeholder="e.g., Make it more formal, Add more details about the deadline, Make it shorter..."
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <button
                  onClick={handleClose}
                  disabled={sending || generating}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium disabled:opacity-50"
                >
                  Cancel
                </button>

                <div className="flex items-center gap-3">
                  {step === 'prompt' && (
                    <button
                      onClick={() => generateReply(false)}
                      disabled={generating || !userPrompt.trim()}
                      className="px-6 py-2 bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {generating ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                          <span>Generating...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles size={18} />
                          <span>Generate Reply</span>
                        </>
                      )}
                    </button>
                  )}

                  {step === 'generated' && !generating && (
                    <>
                      {!showRefineInput ? (
                        <button
                          onClick={handleRefine}
                          disabled={sending}
                          className="px-6 py-2 bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 flex items-center gap-2"
                        >
                          <RefreshCw size={18} />
                          <span>Refine</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => generateReply(true)}
                          disabled={generating || !refinementRequest.trim()}
                          className="px-6 py-2 bg-purple-600 dark:bg-purple-500 hover:bg-purple-700 dark:hover:bg-purple-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {generating ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Refining...</span>
                            </>
                          ) : (
                            <>
                              <RefreshCw size={18} />
                              <span>Apply Refinement</span>
                            </>
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={handleSendClick}
                        disabled={sending || !to.trim() || !subject.trim() || !body.trim()}
                        className="px-6 py-2 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        <Send size={18} />
                        <span>Send Email</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}

      {/* Password Confirmation Modal */}
      <AnimatePresence>
        {showPasswordPrompt && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                if (!sending) {
                  setShowPasswordPrompt(false);
                  setPassword('');
                  setPasswordError('');
                  setSendSuccess(false);
                }
              }}
              className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
            />

            {/* Password Prompt Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-500/40 rounded-lg">
                      <Lock size={20} className="text-green-600 dark:text-green-300" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Confirm Send</h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Enter your CC password to send email</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (!sending) {
                        setShowPasswordPrompt(false);
                        setPassword('');
                        setPasswordError('');
                        setSendSuccess(false);
                      }
                    }}
                    disabled={sending}
                    className="p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                  {sendSuccess && (
                    <div className="bg-green-50 dark:bg-green-500/30 border border-green-200 dark:border-green-600 text-green-700 dark:text-green-300 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Email sent successfully!</span>
                    </div>
                  )}
                  
                  {passwordError && !sendSuccess && (
                    <div className="bg-red-50 dark:bg-red-500/30 border border-red-200 dark:border-red-600 text-red-700 dark:text-red-300 px-4 py-3 rounded-lg text-sm">
                      {passwordError}
                    </div>
                  )}

                  {/* Username Display */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username:
                    </label>
                    <input
                      type="text"
                      value={localStorage.getItem('email') || ''}
                      disabled
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                    />
                  </div>

                  {/* Password Input */}
                  {!sendSuccess && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Password: *
                      </label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setPasswordError('');
                        }}
                        disabled={sending}
                        placeholder="Enter your CC password"
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-green-500 dark:focus:ring-green-300 focus:border-transparent outline-none disabled:bg-gray-100 dark:disabled:bg-gray-800"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !sending && password.trim()) {
                            handleConfirmSend();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  )}

                  {/* Email Preview */}
                  {!sendSuccess && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email Preview:</h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                        <p><span className="font-medium">To:</span> {to || '(no recipient)'}</p>
                        <p><span className="font-medium">Subject:</span> {subject || '(no subject)'}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  {!sendSuccess && (
                    <>
                      <button
                        onClick={() => {
                          if (!sending) {
                            setShowPasswordPrompt(false);
                            setPassword('');
                            setPasswordError('');
                            setSendSuccess(false);
                          }
                        }}
                        disabled={sending}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors font-medium disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSend}
                        disabled={sending || !password.trim()}
                        className="px-6 py-2 bg-green-600 dark:bg-green-500 hover:bg-green-700 dark:hover:bg-green-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {sending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Sending...</span>
                          </>
                        ) : (
                          <>
                            <Send size={18} />
                            <span>Confirm Send</span>
                          </>
                        )}
                      </button>
                    </>
                  )}
                  {sendSuccess && (
                    <div className="w-full text-center text-sm text-gray-600 dark:text-gray-400">
                      Closing automatically...
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </AnimatePresence>
  );
}
