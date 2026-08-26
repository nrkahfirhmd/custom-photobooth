import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { db, listWorkspaces } from '@/lib/db'
import NewWorkspaceButton from './NewWorkspaceButton'

export const dynamic = 'force-dynamic'

type Health = { total: number; failed: number }

function healthFor(id: string): Health {
  return db
    .prepare(
      `SELECT COUNT(*) AS total, COALESCE(SUM(1 - ok), 0) AS failed
       FROM send_log WHERE workspace_id = ?`
    )
    .get(id) as Health
}

export default async function AdminPage() {
  if (!(await isAdmin())) redirect('/login')
  const workspaces = listWorkspaces()

  return (
    <div className="wrap">
      <div className="row between">
        <h1>Workspaces</h1>
        <NewWorkspaceButton />
      </div>

      <div className="card" style={{ marginTop: '1.25rem' }}>
        {workspaces.length === 0 && (
          <p className="muted">
            No workspaces yet. Create one for your event, upload a frame, position the
            photo slots, and add the email sender.
          </p>
        )}
        {workspaces.map((ws) => {
          const health = healthFor(ws.id)
          return (
            <div key={ws.id} className="ws-item">
              <div>
                <Link href={`/admin/${ws.id}`}>
                  <strong>{ws.name}</strong>
                </Link>
                <div className="muted">
                  {ws.shot_count} photo{ws.shot_count === 1 ? '' : 's'} ·{' '}
                  {ws.frame_file ? 'frame set' : 'no frame yet'} ·{' '}
                  {health.total === 0
                    ? 'no sends yet'
                    : `${health.total} sent, ${health.failed} failed`}
                </div>
              </div>
              <Link href={`/b/${ws.id}`} target="_blank" className="muted">
                open booth ↗
              </Link>
            </div>
          )
        })}
      </div>
    </div>
  )
}
