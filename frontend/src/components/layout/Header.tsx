import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Trophy, Menu, X, Plus, LogIn } from 'lucide-react'

const Header: React.FC = () => {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const isActive = (path: string) => pathname === path

  return (
    <header className="dls-navbar">
      <div className="dls-container">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 no-underline">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#1155CC,#1460E8)' }}>
              <Trophy size={16} color="#fff" />
            </div>
            <span className="font-bold text-white text-base tracking-tight">DLS Hub</span>
            <span className="dls-badge dls-badge-blue hidden sm:inline-flex">DLS 26</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            <Link to="/tournaments" className="dls-btn dls-btn-ghost dls-btn-sm"
              style={{ color: isActive('/tournaments') ? '#fff' : '#94A3B8', fontWeight: isActive('/tournaments') ? 600 : 400 }}>
              Tournois
            </Link>
            <Link to="/create" className="dls-btn dls-btn-ghost dls-btn-sm"
              style={{ color: isActive('/create') ? '#fff' : '#94A3B8', fontWeight: isActive('/create') ? 600 : 400 }}>
              Créer
            </Link>
            <Link to="/join" className="dls-btn dls-btn-ghost dls-btn-sm"
              style={{ color: isActive('/join') ? '#fff' : '#94A3B8', fontWeight: isActive('/join') ? 600 : 400 }}>
              Rejoindre
            </Link>
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => navigate('/create')}
              className="dls-btn dls-btn-primary dls-btn-sm flex items-center gap-1.5">
              <Plus size={14} /> Créer
            </button>
          </div>

          {/* Mobile toggle */}
          <button className="md:hidden dls-btn dls-btn-ghost dls-btn-sm"
            onClick={() => setOpen(o => !o)} aria-label="Menu">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#0F1020' }}>
          <div className="dls-container py-3 flex flex-col gap-1">
            <Link to="/tournaments" onClick={() => setOpen(false)}
              className="dls-btn dls-btn-ghost text-left justify-start" style={{ color: '#94A3B8' }}>
              🏆 Tournois
            </Link>
            <Link to="/join" onClick={() => setOpen(false)}
              className="dls-btn dls-btn-ghost text-left justify-start" style={{ color: '#94A3B8' }}>
              <LogIn size={14} /> Rejoindre
            </Link>
            <Link to="/create" onClick={() => setOpen(false)}
              className="dls-btn dls-btn-primary mt-1 flex items-center gap-1.5">
              <Plus size={14} /> Créer un tournoi
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
