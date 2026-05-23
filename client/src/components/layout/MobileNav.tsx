import { Link, useLocation } from 'react-router-dom';
import { Home, Compass, PlusSquare, Heart, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotificationStore } from '../../store/useNotifications';

export function MobileNav() {
  const location = useLocation();
  const unreadCount = useNotificationStore(s => s.unreadCount);

  const NAV_ITEMS = [
    { to: '/',                         Icon: Home,          label: 'Home'           },
    { to: '/search',                   Icon: Compass,       label: 'Explore'        },
    { to: '/create',                   Icon: PlusSquare,    label: 'Create'         },
    { to: '/notifications',            Icon: Heart,         label: 'Notifications', badge: unreadCount },
    { to: '/messages',                 Icon: MessageCircle, label: 'Messages'       },
  ];

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 360, damping: 30, delay: 0.12 }}
      className="md:hidden fixed bottom-0 left-0 right-0 z-50
                 bg-surface-dark/95 backdrop-blur-2xl
                 border-t border-white/[0.04]"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map(({ to, Icon, label, badge }) => {
          const active = isActive(to);
          const showBadge = badge != null && badge > 0;
          return (
            <Link
              key={label}
              to={to}
              aria-label={label}
              className="relative flex flex-col items-center justify-center flex-1 h-full"
            >
              <motion.div
                whileTap={{ scale: 0.72 }}
                transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                className="relative flex items-center justify-center p-2"
              >
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${
                    active
                      ? 'text-neon-cyan'
                      : 'text-gray-500'
                  }`}
                  fill={active ? 'currentColor' : 'none'}
                />

                {active && (
                  <motion.span
                    layoutId="mobile-nav-active-dot"
                    className="absolute -bottom-2 w-1.5 h-1.5 rounded-full"
                    style={{ background: '#00FFD1', boxShadow: '0 0 8px rgba(0, 255, 209, 0.6)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}

                <AnimatePresence>
                  {showBadge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                      className="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] flex items-center justify-center px-0.5 text-[9px] font-bold text-surface-dark bg-neon-cyan rounded-full"
                      style={{ boxShadow: '0 0 6px rgba(0, 255, 209, 0.5)' }}
                    >
                      {(badge ?? 0) > 9 ? '9+' : badge}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </motion.nav>
  );
}