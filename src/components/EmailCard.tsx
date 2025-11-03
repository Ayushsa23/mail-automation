import { motion } from 'framer-motion';
import { Mail, Reply } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export type EmailCategory = 
  | 'Important-Academics'
  | 'Important-Deadline'
  | 'Event'
  | 'General';

interface EmailCardProps {
  sender: string;
  subject: string;
  summary: string;
  date: string | Date;
  category: EmailCategory;
  index: number;
  originalBody?: string;
  onReply?: (sender: string, subject: string, originalBody?: string) => void;
}

const categoryConfig = {
  'Important-Academics': {
    bg: 'bg-blue-200 dark:bg-blue-500/40',
    text: 'text-blue-800 dark:text-blue-200',
    label: 'Academics',
  },
  'Important-Deadline': {
    bg: 'bg-red-200 dark:bg-red-500/40',
    text: 'text-red-800 dark:text-red-200',
    label: 'Deadline',
  },
  'Event': {
    bg: 'bg-green-200 dark:bg-green-500/40',
    text: 'text-green-800 dark:text-green-200',
    label: 'Event',
  },
  'General': {
    bg: 'bg-[#efefef] dark:bg-gray-600',
    text: 'text-black dark:text-gray-200',
    label: 'General',
  },
};

export default function EmailCard({
  sender,
  subject,
  summary,
  date,
  category,
  index,
  originalBody,
  onReply,
}: EmailCardProps) {
  const { theme } = useTheme();
  const config = categoryConfig[category] || categoryConfig.General;

  const formatDate = (dateValue: string | Date): string => {
    const emailDate = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    const today = new Date();
    
    const isToday = 
      emailDate.getDate() === today.getDate() &&
      emailDate.getMonth() === today.getMonth() &&
      emailDate.getFullYear() === today.getFullYear();
    
    if (isToday) {
      return emailDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } else {
      return emailDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const formattedDate = formatDate(date);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="rounded-2xl shadow-sm hover:shadow-md dark:hover:shadow-lg transition-shadow p-5 border border-gray-100 dark:border-gray-700"
      style={{ 
        backgroundColor: 'var(--card-bg, white)',
        color: 'var(--card-text, black)'
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-200 dark:bg-blue-500/40 rounded-lg">
            <Mail size={20} className="text-blue-700 dark:text-blue-300" />
          </div>
          <div>
            <h3 className="font-semibold dark:text-gray-100" style={{ color: 'var(--card-text, black)' }}>{sender}</h3>
            <p className="text-sm dark:text-gray-400" style={{ color: 'var(--card-text, black)' }}>{formattedDate}</p>
          </div>
        </div>

        <span
          className={`px-3 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}
          style={category === 'General' && theme === 'light' ? {
            backgroundColor: '#efefef',
            color: '#000000'
          } : category !== 'General' ? { color: 'var(--card-text, black)' } : {}}
        >
          {config.label}
        </span>
      </div>

      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h4 className="font-medium dark:text-gray-100 mb-2" style={{ color: 'var(--card-text, black)' }}>{subject}</h4>
          <p className="text-sm dark:text-gray-400 leading-relaxed" style={{ color: 'var(--card-text, black)' }}>{summary}</p>
        </div>
        
        {onReply && (
          <button
            onClick={() => onReply(sender, subject, originalBody)}
            className="ml-4 p-2 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-500/30 rounded-lg transition-colors flex items-center gap-2"
            title="Quick Reply"
          >
            <Reply size={18} />
            <span className="text-sm font-medium hidden sm:inline">Reply</span>
          </button>
        )}
      </div>
    </motion.div>
  );
}
