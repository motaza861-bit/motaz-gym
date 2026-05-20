export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

export function scheduleNotifications(prefs) {
  if (!prefs?.enabled || !('Notification' in window) || Notification.permission !== 'granted') return
  const now = new Date()
  const entries = [
    { time: prefs.workoutTime, title: 'Workout Time! 💪', body: "Let's train. Open the app to log your session." },
    { time: prefs.foodTime,    title: 'Log Your Food 🥗', body: 'Track your nutrition to hit your macro goals.' },
  ]
  for (const { time, title, body } of entries) {
    if (!time) continue
    const [h, m] = time.split(':').map(Number)
    const target = new Date(now)
    target.setHours(h, m, 0, 0)
    if (target <= now) target.setDate(target.getDate() + 1)
    const delay = target - now
    setTimeout(() => new Notification(title, { body, icon: '/favicon.ico' }), delay)
  }
}
