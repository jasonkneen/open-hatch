import { useState } from 'react';
import { X, Crown, ChevronDown, Trash2, Loader2 } from 'lucide-react';
import type { WorkspaceMember } from '../../hooks/useSharing';

interface ShareDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  workspaceName: string;
  currentUserEmail: string;
  members: WorkspaceMember[];
  autoShare: boolean;
  onToggleAutoShare: () => void;
  onInvite: (email: string) => Promise<{ error: string | null }>;
  onRemoveMember: (memberId: string) => void;
  onUpdateRole: (memberId: string, role: 'editor' | 'viewer') => void;
}

export function ShareDialog({
  open,
  onClose,
  title,
  workspaceName,
  currentUserEmail,
  members,
  autoShare,
  onToggleAutoShare,
  onInvite,
  onRemoveMember,
  onUpdateRole,
}: ShareDialogProps) {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviting, setInviting] = useState(false);
  const [roleDropdown, setRoleDropdown] = useState<string | null>(null);

  if (!open) return null;

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteError('');
    setInviting(true);
    const result = await onInvite(inviteEmail.trim());
    setInviting(false);
    if (result.error) {
      setInviteError(result.error);
    } else {
      setInviteEmail('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInvite();
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '480px',
          background: 'var(--canvas-elevated)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-xl)',
          overflow: 'hidden',
          animation: 'fadeSlideIn 0.2s ease forwards',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 24px 16px',
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: 0,
          }}>Share {title}</h2>
          <button
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--canvas-raised)',
              border: '1px solid var(--border)',
              borderRadius: '50%',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: '0 24px 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{
            background: 'var(--canvas-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}>
            <p style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 8px',
            }}>Auto-sharing</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button
                onClick={onToggleAutoShare}
                style={{
                  width: '44px',
                  height: '24px',
                  borderRadius: '12px',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '2px',
                  background: autoShare ? 'var(--accent)' : 'var(--border-strong)',
                  transition: 'background var(--transition-fast)',
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <div style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '50%',
                  background: 'white',
                  transition: 'transform var(--transition-fast)',
                  transform: autoShare ? 'translateX(20px)' : 'translateX(0px)',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                }} />
              </button>
              <p style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                margin: 0,
                lineHeight: 1.5,
              }}>
                Share with everyone in workspace <strong style={{ color: 'var(--text-primary)' }}>{workspaceName}</strong>, including anyone who joins in the future
              </p>
            </div>
          </div>

          <div style={{
            background: 'var(--canvas-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}>
            <p style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 12px',
            }}>Invite anyone</p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="email"
                placeholder="Enter email address..."
                value={inviteEmail}
                onChange={e => { setInviteEmail(e.target.value); setInviteError(''); }}
                onKeyDown={handleKeyDown}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: 'var(--canvas-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  outline: 'none',
                  transition: 'border-color var(--transition-fast)',
                  fontFamily: 'inherit',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              />
              <button
                onClick={handleInvite}
                disabled={inviting || !inviteEmail.trim()}
                style={{
                  padding: '10px 20px',
                  background: inviting ? 'var(--accent-hover)' : 'var(--accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-md)',
                  color: 'white',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: inviting || !inviteEmail.trim() ? 'not-allowed' : 'pointer',
                  transition: 'background var(--transition-fast)',
                  fontFamily: 'inherit',
                  opacity: !inviteEmail.trim() ? 0.5 : 1,
                  flexShrink: 0,
                }}
              >
                {inviting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Add'}
              </button>
            </div>
            {inviteError && (
              <p style={{
                fontSize: '12px',
                color: 'var(--error)',
                margin: '8px 0 0',
              }}>{inviteError}</p>
            )}

            {members.length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <p style={{
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                  margin: '0 0 8px',
                }}>Invite workspace members</p>
                <p style={{
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  margin: 0,
                }}>Everyone in the workspace already has access.</p>
              </div>
            )}
          </div>

          <div style={{
            background: 'var(--canvas-raised)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}>
            <p style={{
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 12px',
            }}>People with access</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <PersonRow
                email={currentUserEmail}
                role="owner"
                isCurrentUser={true}
                onRemove={() => {}}
                onChangeRole={() => {}}
                roleDropdownOpen={false}
                onToggleDropdown={() => {}}
              />

              {members.map(member => (
                <PersonRow
                  key={member.id}
                  email={member.email || member.user_id.slice(0, 8)}
                  role={member.role}
                  isCurrentUser={false}
                  onRemove={() => onRemoveMember(member.id)}
                  onChangeRole={(role) => onUpdateRole(member.id, role)}
                  roleDropdownOpen={roleDropdown === member.id}
                  onToggleDropdown={() => setRoleDropdown(prev => prev === member.id ? null : member.id)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PersonRow({
  email,
  role,
  isCurrentUser,
  onRemove,
  onChangeRole,
  roleDropdownOpen,
  onToggleDropdown,
}: {
  email: string;
  role: string;
  isCurrentUser: boolean;
  onRemove: () => void;
  onChangeRole: (role: 'editor' | 'viewer') => void;
  roleDropdownOpen: boolean;
  onToggleDropdown: () => void;
}) {
  const initial = (email[0] || 'U').toUpperCase();
  const displayRole = role === 'owner' ? 'Owner' : role === 'editor' ? 'Editor' : 'Viewer';

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '6px 0',
    }}>
      <div style={{
        width: '32px',
        height: '32px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--accent), #60a5fa)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '13px',
        fontWeight: 600,
        color: 'white',
        flexShrink: 0,
      }}>{initial}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          margin: 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {email} {isCurrentUser && (
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(you)</span>
          )}
        </p>
      </div>

      {isCurrentUser ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 10px',
          background: 'var(--canvas-overlay)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}>
          <Crown size={12} />
          {displayRole}
        </div>
      ) : (
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={onToggleDropdown}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              background: 'var(--canvas-overlay)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {displayRole}
            <ChevronDown size={12} />
          </button>

          {roleDropdownOpen && (
            <div style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: '4px',
              background: 'var(--canvas-overlay)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              zIndex: 10,
              minWidth: '120px',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => { onChangeRole('editor'); onToggleDropdown(); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: role === 'editor' ? 'var(--accent-subtle)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >Editor</button>
              <button
                onClick={() => { onChangeRole('viewer'); onToggleDropdown(); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: role === 'viewer' ? 'var(--accent-subtle)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-primary)',
                  fontSize: '12px',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                }}
              >Viewer</button>
              <div style={{ height: '1px', background: 'var(--border)' }} />
              <button
                onClick={() => { onRemove(); onToggleDropdown(); }}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--error)',
                  fontSize: '12px',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Trash2 size={12} />
                Remove
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
