import React from 'react';
import { Menu, Shield } from 'lucide-react';

export default function Header({ user, title, onToggleMobileNav, extraActions }) {
  return (
    <>
      <div className="mobile-top">
        <button onClick={onToggleMobileNav} className="mobile-menu-btn" aria-label="Toggle navigation">
          <Menu size={22} />
        </button>
        <div className="mobile-brand-title">
          <img src="/logo.png" alt="Logo" className="site-logo-mobile" />
        </div>
        <span className="avatar sm">{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
      </div>

      <header className="app-header">
        <div>
          <p className="eyebrow">
            WORKSPACE / {user?.role ? user.role.replaceAll('_', ' ') : 'USER'}
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
