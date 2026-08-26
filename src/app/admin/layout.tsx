import NotificationToasts from './NotificationToasts'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <NotificationToasts />
      {children}
    </>
  )
}
