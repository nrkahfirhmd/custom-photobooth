import Link from 'next/link'
import { redirect } from 'next/navigation'
import { isAdmin } from '@/lib/auth'
import { db, listWorkspaces } from '@/lib/db'
import { AlertIcon, CameraIcon, CheckIcon, ExternalIcon } from '@/components/icons'
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
      <div className="row between" style={{ marginBottom: 'var(--space-xl)' }}>
        <div>
          <h1>Workspaces</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>
            One workspace per event — its own frame, shot count and email sender.
          </p>
        </div>
        <NewWorkspaceButton />
      </div>

      {workspaces.length === 0 ? (
        <div className="card empty rise">
          <CameraIcon size={48} />
          <h2>No workspaces yet</h2>
          <p className="muted" style={{ maxWidth: 420, margin: '0 auto' }}>
            Create one for your event, upload a frame, position the photo slots, then add
            the email sender.
          </p>
        </div>
      ) : (
        <div className="ws-list">
          {workspaces.map((ws) => {
            const health = healthFor(ws.id)
            return (
              <div key={ws.id} className="ws-card rise">
                <div style={{ minWidth: 0 }}>
                  <h3>
                    <Link href={`/admin/${ws.id}`}>{ws.name}</Link>
                  </h3>
                  <div className="meta">
                    <span>
                      {ws.shot_count} photo{ws.shot_count === 1 ? '' : 's'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{ws.frame_file ? 'Frame set' : 'No frame yet'}</span>
                    {health.total > 0 && (
                      <span
                        className={`badge ${health.failed > 0 ? 'warn' : ''}`}
                        title={`${health.total} send attempts, ${health.failed} failed`}
                      >
                        {health.failed > 0 ? (
                          <AlertIcon size={13} />
                        ) : (
                          <CheckIcon size={13} />
                        )}
                        {health.failed > 0
                          ? `${health.failed} of ${health.total} failed`
                          : `${health.total} sent`}
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={`/b/${ws.id}`}
                  target="_blank"
                  className="row"
                  style={{ gap: 6, flex: 'none', textDecoration: 'none' }}
                >
                  Booth
                  <ExternalIcon size={16} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
