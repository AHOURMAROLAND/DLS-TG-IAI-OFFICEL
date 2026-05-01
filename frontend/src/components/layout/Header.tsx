import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Trophy, Menu, X, Plus, LogIn, LogOut, User } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import toast from 'react-hot-toast'

const Header: React.FC = () => {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout, isAuthenticated } = useAuth()

  const isActive = (path: string) => pathname === path || pathname.startsWith(path + '/')

  const handleLogout = async () => {
    await logout()
    toast.success('Déconnecté')
    navigate('/')
    setOpen(false)
  }

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
            <Link to="/join" className="dls-btn dls-btn-ghost dls-btn-sm"
              style={{ color: isActive('/join') ? '#fff' : '#94A3B8' }}>
              Rejoindre
            </Link>
          </nav>

          {/* Actions */}
          <div className="hidden md:flex items-center gap-2">
            {isAuthenticated ? (
              <>
                <span className="text-sm font-medium" style={{ color: '#94A3B8' }}>
                  <User size={14} className="inline mr-1" />{user?.pseudo}
                </span>
                <button onClick={() => navigate('/create')}
                  className="dls-btn dls-btn-primary dls-btn-sm flex items-center gap-1.5">
                  <Plus size={14} /> Créer
                </button>
                <button onClick={handleLogout}
                  className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5"
                  style={{ color: '#64748B' }}>
                  <LogOut size={14} />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => navigate('/login')}
                  className="dls-btn dls-btn-ghost dls-btn-sm flex items-center gap-1.5"
                  style={{ color: '#94A3B8' }}>
                  <LogIn size={14} /> Connexion
                </button>
                <button onClick={() => navigate('/register')}
                  className="dls-btn dls-btn-primary dls-btn-sm">
                  Créer un compte
                </button>
              </>
            )}
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
              className="dls-btn dls-btn-ghost text-left justify-start flex items-center gap-2" style={{ color: '#94A3B8' }}>
              <Trophy size={14} /> Tournois
            </Link>
            <Link to="/join" onClick={() => setOpen(false)}
              className="dls-btn dls-btn-ghost text-left justify-start" style={{ color: '#94A3B8' }}>
              Rejoindre
            </Link>
            {isAuthenticated ? (
              <>
                <Link to="/create" onClick={() => setOpen(false)}
                  className="dls-btn dls-btn-primary mt-1 flex items-center gap-1.5">
                  <Plus size={14} /> Créer un tournoi
                </Link>
                <button onClick={handleLogout}
                  className="dls-btn dls-btn-ghost text-left justify-start mt-1"
                  style={{ color: '#F87171' }}>
                  <LogOut size={14} className="mr-1" /> Déconnexion ({user?.pseudo})
                </button>
              </>
            ) : (
              <>
                <Link to="/login" onClick={() => setOpen(false)}
                  className="dls-btn dls-btn-ghost text-left justify-start" style={{ color: '#94A3B8' }}>
                  <LogIn size={14} className="mr-1" /> Connexion
                </Link>
                <Link to="/register" onClick={() => setOpen(false)}
                  className="dls-btn dls-btn-primary mt-1">
                  Créer un compte
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  )
}

export default Header
