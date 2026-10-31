import React from 'react';
import { Menu, Sun, Shield } from 'lucide-react';

export default function Header({ user, title, onToggleMobileNav, extraActions }) {
  return (
    <>
      <div className="mobile-top">
        <button onClick={onToggleMobileNav} className="mobile-menu-btn" aria-label="Toggle navigation">
          <Menu size={22} />
        </button>
        <div className="mobile-brand-title">
          <Sun size={18} className="text-amber-500" />
          <strong>{title}</strong>
        </div>
        <span className="avatar sm">{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
      </div>

      <header className="app-header">
        <div>
          <p className="eyebrow">
            SUNPOWER SOLUTIONS / {user?.role ? user.role.replaceAll('_', ' ') : 'WORKSPACE'}
          </p>
          <h1>{title}</h1>
        </div>

        <div className="header-actions">
          {extraActions}
          <div className="header-user">
            <div className="role-pill">
              <Shield size={13} />
              <span>{user?.role ? user.role.replaceAll('_', ' ') : 'USER'}</span>
            </div>
            <span>{user?.name}</span>
            <span className="avatar">{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
          </div>
        </div>
      </header>
    </>
  );
}

