
import { useEffect, useState } from 'react'
import { Bell, CheckCheck, X } from 'lucide-react'
import { supabase } from './lib/supabase'
import './Notifications.css'

interface Notification {
  id: string
  recipient_id: string
  appointment_id: string | null
  notification_type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

interface NotificationsProps {
  userId: string
}

export default function Notifications({ userId }: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  const unreadCount = notifications.filter(
    notification => !notification.is_read
  ).length

  useEffect(() => {
    if (!userId) return

    let mounted = true

    const loadNotifications = async () => {
      setLoading(true)

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (!mounted) return

      if (error) {
        console.error('Notification loading error:', error.message)
      } else {
        setNotifications(data || [])
      }

      setLoading(false)
    }

    loadNotifications()

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `recipient_id=eq.${userId}`,
        },
        payload => {
          if (!mounted) return

          if (payload.eventType === 'INSERT') {
            const newNotification = payload.new as Notification

            setNotifications(current => [
              newNotification,
              ...current.filter(item => item.id !== newNotification.id),
            ].slice(0, 50))
          }

          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Notification

            setNotifications(current =>
              current.map(item =>
                item.id === updated.id ? updated : item
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      mounted = false
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAsRead = async (id: string) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)
      .eq('recipient_id', userId)

    if (error) {
      console.error('Could not mark notification as read:', error.message)
      return
    }

    setNotifications(current =>
      current.map(item =>
        item.id === id ? { ...item, is_read: true } : item
      )
    )
  }

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false)

    if (error) {
      console.error('Could not mark notifications as read:', error.message)
      return
    }

    setNotifications(current =>
      current.map(item => ({ ...item, is_read: true }))
    )
  }

  return (
    <div className="yd-notification-wrapper">
      <button
        className="yd-notification-bell"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        aria-expanded={isOpen}
      >
        <Bell size={21} />

        {unreadCount > 0 && (
          <span className="yd-notification-count">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="yd-notification-panel">
          <div className="yd-notification-header">
            <div>
              <h3>Notifications</h3>
              <p>{unreadCount} unread</p>
            </div>

            <div className="yd-notification-actions">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  title="Mark all as read"
                  aria-label="Mark all as read"
                >
                  <CheckCheck size={19} />
                </button>
              )}

              <button
                onClick={() => setIsOpen(false)}
                aria-label="Close notifications"
              >
                <X size={19} />
              </button>
            </div>
          </div>

          <div className="yd-notification-list">
            {loading ? (
              <p className="yd-notification-empty">Loading...</p>
            ) : notifications.length === 0 ? (
              <p className="yd-notification-empty">
                You're all caught up. No notifications yet.
              </p>
            ) : (
              notifications.map(notification => (
                <div
                  key={notification.id}
                  className={`yd-notification-item ${
                    notification.is_read ? '' : 'unread'
                  }`}
                >
                  <div className="yd-notification-dot" />

                  <div className="yd-notification-content">
                    <h4>{notification.title}</h4>
                    <p>{notification.message}</p>
                    <span>
                      {new Date(notification.created_at).toLocaleString()}
                    </span>
                  </div>

                  {!notification.is_read && (
                    <button
                      className="yd-mark-read"
                      onClick={() => markAsRead(notification.id)}
                      aria-label="Mark as read"
                      title="Mark as read"
                    >
                      <CheckCheck size={17} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
