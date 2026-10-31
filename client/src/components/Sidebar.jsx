import React from 'react';
import {
  BarChart3,
  Users,
  ClipboardList,
  Package,
  Home,
  Truck,
  Wrench,
  ShieldCheck,
  LifeBuoy,
  LogOut,
  Sun,
  Boxes,
} from 'lucide-react';

export default function Sidebar({ user, currentSection, onNavigate, onLogout }) {
  const getNavLinks = (role) => {
    switch (role) {
      case 'SUPER_ADMIN':
      case 'DIRECTOR':
        return [
          { key: 'director', label: "Director's Month-End", icon: BarChart3 },
          { key: 'leads', label: 'Enquiries & Feasibility', icon: Users },
          { key: 'surveys', label: 'Roof Surveys', icon: ClipboardList },
          { key: 'quotes', label: 'Quotes & BOM', icon: Package },
          { key: 'projects', label: 'Projects & Subsidies', icon: Home },
          { key: 'inventory', label: 'Stock & Inward', icon: Boxes },
          { key: 'dispatches', label: 'Dispatch & Serials', icon: Truck },
          { key: 'installations', label: 'Installation Jobs', icon: Wrench },
          { key: 'warranties', label: 'Warranty Registry', icon: ShieldCheck },
          { key: 'tickets', label: 'Support & Repairs', icon: LifeBuoy },
        ];
      case 'SALES_EXECUTIVE':
        return [
          { key: 'leads', label: 'Enquiries & Feasibility', icon: Users },
          { key: 'surveys', label: 'Surveys Review', icon: ClipboardList },
          { key: 'quotes', label: 'Quotes & BOM', icon: Package },
          { key: 'projects', label: 'Projects & Advance', icon: Home },
          { key: 'warranties', label: 'Warranty Registry', icon: ShieldCheck },
        ];
      case 'SURVEY_TECHNICIAN':
        return [
          { key: 'surveys', label: 'My Roof Surveys', icon: ClipboardList },
        ];
      case 'WAREHOUSE_MANAGER':
        return [
          { key: 'dispatches', label: 'Dispatch & Packing', icon: Truck },
          { key: 'inventory', label: 'Stock & Inward', icon: Boxes },
          { key: 'warranties', label: 'Serial & Warranties', icon: ShieldCheck },
        ];
      case 'INSTALLATION_TECHNICIAN':
        return [
          { key: 'installations', label: 'My Installation Jobs', icon: Wrench },
        ];
      case 'SUPPORT_EXECUTIVE':
        return [
          { key: 'tickets', label: 'Support Desk & Lookup', icon: LifeBuoy },
          { key: 'warranties', label: 'Warranty Registry', icon: ShieldCheck },
          { key: 'inventory', label: 'Stock Overview', icon: Boxes },
        ];
      case 'CUSTOMER':
        return [
          { key: 'customer-portal', label: 'My Solar Project', icon: Home },
          { key: 'warranties', label: 'My Warranties', icon: ShieldCheck },
          { key: 'tickets', label: 'Support & Service', icon: LifeBuoy },
        ];
      default:
        return [
          { key: 'leads', label: 'Enquiries', icon: Users },
        ];
    }
  };

  const navLinks = getNavLinks(user?.role);

  return (
    <aside className="sidebar">
      <div className="side-brand">
        <span className="brand-mark">
          <Sun size={18} />
        </span>
        <div>
          <span>SunPower</span>
          <small className="brand-sub">SIMS PLATFORM</small>
        </div>
      </div>

      <div className="workspace-label">
        {user?.role === 'CUSTOMER' ? 'CUSTOMER PORTAL' : 'WORKSPACE'}
      </div>

      <nav className="side-nav">
        {navLinks.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            className={`nav-item ${currentSection === key ? 'active' : ''}`}
            onClick={() => onNavigate(key)}
          >
            <Icon size={18} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      <div className="side-bottom">
        <div className="user-mini">
          <span className="avatar">{user?.name ? user.name[0].toUpperCase() : 'U'}</span>
          <div className="user-info-text">
            <strong>{user?.name || 'User'}</strong>
            <small>{user?.role ? user.role.replaceAll('_', ' ') : ''}</small>
          </div>
        </div>

        <button className="nav-item signout-btn" onClick={onLogout}>
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

