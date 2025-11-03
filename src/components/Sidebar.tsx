import { motion } from 'framer-motion';
import { Calendar, BookOpen, Clock, CalendarDays } from 'lucide-react';

interface CategorizedEvent {
  text: string;
  type: 'exam' | 'deadline' | 'event';
}

interface SidebarProps {
  upcomingDates: string[];
}

export default function Sidebar({ upcomingDates }: SidebarProps) {
  const categorizeEvents = (events: string[]): CategorizedEvent[] => {
    return events.map((event) => {
      const parts = event.split('|');
      if (parts.length === 2) {
        const typeIndicator = parts[1].trim().toLowerCase();
        const text = parts[0].trim();
        if (typeIndicator === 'academic') {
          return { text, type: 'deadline' as const };
        }
        const type = typeIndicator as 'exam' | 'deadline' | 'event';
        return { text, type };
      }
      
      const lowerEvent = event.toLowerCase();
      if (lowerEvent.includes('exam') || lowerEvent.includes('test') || lowerEvent.includes('quiz')) {
        return { text: event, type: 'exam' };
      }
      if (lowerEvent.includes('deadline') || lowerEvent.includes('submission') || lowerEvent.includes('due')) {
        return { text: event, type: 'deadline' };
      }
      if (
        lowerEvent.includes('assignment') || 
        lowerEvent.includes('course') || 
        lowerEvent.includes('class') || 
        lowerEvent.includes('lecture') || 
        lowerEvent.includes('lab') || 
        lowerEvent.includes('semester') || 
        lowerEvent.includes('midterm') || 
        lowerEvent.includes('final') || 
        lowerEvent.includes('academic') || 
        lowerEvent.includes('project') ||
        lowerEvent.includes('presentation') ||
        lowerEvent.includes('workshop') ||
        lowerEvent.includes('tutorial')
      ) {
        return { text: event, type: 'deadline' };
      }
      return { text: event, type: 'event' };
    });
  };

  const categorizedEvents = categorizeEvents(upcomingDates);
  
  const importantDates = categorizedEvents.filter(
    (e) => e.type === 'exam' || e.type === 'deadline'
  );
  const otherEvents = categorizedEvents.filter((e) => e.type === 'event');

  return (
    <div className="space-y-4 sticky top-24">
      {/* Important Days Card - Exams and Deadlines */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700"
        style={{ 
          backgroundColor: 'var(--card-bg, white)',
          color: 'var(--card-text, black)'
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Clock size={20} className="text-red-700 dark:text-red-300" />
          <h2 className="text-lg font-bold dark:text-gray-100" style={{ color: 'var(--card-text, black)' }}>Important Days</h2>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {importantDates.length === 0 ? (
            <p className="text-sm dark:text-gray-400 italic" style={{ color: 'var(--card-text, black)' }}>No upcoming exams or deadlines</p>
          ) : (
            importantDates.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.3 + index * 0.05 }}
                className={`flex items-start gap-3 p-3 rounded-lg transition ${
                  item.type === 'exam'
                    ? 'bg-red-200 dark:bg-red-500/30 hover:bg-red-300 dark:hover:bg-red-500/40'
                    : 'bg-orange-200 dark:bg-orange-500/30 hover:bg-orange-300 dark:hover:bg-orange-500/40'
                }`}
              >
                {item.type === 'exam' ? (
                  <BookOpen size={16} className="text-red-700 dark:text-red-300 mt-0.5 flex-shrink-0" />
                ) : (
                  <Clock size={16} className="text-orange-700 dark:text-orange-300 mt-0.5 flex-shrink-0" />
                )}
                <p className="text-sm dark:text-gray-300 flex-1" style={{ color: 'var(--card-text, black)' }}>{item.text}</p>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Other Events Card */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700"
        style={{ 
          backgroundColor: 'var(--card-bg, white)',
          color: 'var(--card-text, black)'
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <CalendarDays size={20} className="text-blue-700 dark:text-blue-300" />
          <h2 className="text-lg font-bold dark:text-gray-100" style={{ color: 'var(--card-text, black)' }}>Other Events</h2>
        </div>

        <div className="space-y-3 max-h-80 overflow-y-auto">
          {otherEvents.length === 0 ? (
            <p className="text-sm dark:text-gray-400 italic" style={{ color: 'var(--card-text, black)' }}>No other events found</p>
          ) : (
            otherEvents.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.4 + index * 0.05 }}
                className="flex items-start gap-3 p-3 bg-blue-200 dark:bg-blue-500/30 rounded-lg hover:bg-blue-300 dark:hover:bg-blue-500/40 transition"
              >
                <Calendar size={16} className="text-blue-700 dark:text-blue-300 mt-0.5 flex-shrink-0" />
                <p className="text-sm dark:text-gray-300 flex-1" style={{ color: 'var(--card-text, black)' }}>{item.text}</p>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
