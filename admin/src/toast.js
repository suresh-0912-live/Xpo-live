// Tiny toast pub/sub — plain functions live here (not in ui.jsx) because
// react-refresh requires component files to export only components.
// Call toast('Saved', 'ok') from anywhere; mount <Toaster /> once in App.

let idSeq = 0
const subscribers = new Set()

export function toast(message, tone = 'info') {
  const item = { id: ++idSeq, message, tone }
  for (const notify of subscribers) notify(item)
}

export function subscribeToasts(onToast) {
  subscribers.add(onToast)
  return () => {
    subscribers.delete(onToast)
  }
}
